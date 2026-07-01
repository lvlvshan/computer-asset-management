// 维修管理控制器
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../prisma/client'

// 维修人员：获取设备列表
export async function getDevicesForMaintenance(req: AuthRequest, res: Response) {
  try {
    const { status, search } = req.query
    const where: any = {}
    if (status) where.status = status
    if (search) {
      const s = search as string
      where.OR = [
        // Device 顶层字符串字段
        { name: { contains: s } },
        { deviceCode: { contains: s } },
        { currentUserName: { contains: s } },
        { organization: { contains: s } },
        { location: { contains: s } },
        // DeviceHardware 1:1 关联字段（同一个嵌套 OR 保证只 JOIN 一次）
        {
          hardware: {
            OR: [
              { cpu: { contains: s } },
              { memory: { contains: s } },
              { disk: { contains: s } },
              { gpu: { contains: s } },
              { macAddress: { contains: s } },
              { os: { contains: s } },
              { motherboard: { contains: s } },
              { networkCards: { contains: s } },
            ],
          },
        },
        // 系统用户名
        { currentUser: { username: { contains: s } } },
      ]
    }

    const devices = await prisma.device.findMany({
      where,
      select: {
        id: true,
        deviceCode: true,
        name: true,
        status: true,
        currentUserName: true,
        organization: true,
        location: true,
        createdAt: true,
        hardware: { select: { macAddress: true } },
        currentUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(devices)
  } catch (error) {
    console.error('获取维修设备列表错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 维修人员：提交维修记录（需审批）
export async function submitMaintenance(req: AuthRequest, res: Response) {
  try {
    const { userId: submitterId } = req
    const {
      deviceId, maintenanceType, description, solution,
      cost, vendor, startDate, endDate, currentUserName,
    } = req.body

    if (!deviceId || !maintenanceType || !description || !startDate) {
      res.status(400).json({ error: '设备、维修类型、故障描述和送修日期为必填项' })
      return
    }

    const pending = await prisma.pendingMaintenance.create({
      data: {
        deviceId,
        maintenanceType,
        description,
        solution: solution || null,
        cost: cost ? parseFloat(cost) : null,
        vendor: vendor || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        currentUserName: currentUserName || null,
        status: 'PENDING',
        submitterId: submitterId!,
      },
      include: {
        device: { select: { id: true, deviceCode: true, name: true } },
        submitter: { select: { id: true, username: true } },
      },
    })

    res.status(201).json(pending)
  } catch (error) {
    console.error('提交维修记录错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 维修人员：查看自己提交的记录
export async function getMySubmissions(req: AuthRequest, res: Response) {
  try {
    const { userId } = req

    const records = await prisma.pendingMaintenance.findMany({
      where: { submitterId: userId },
      include: {
        device: { select: { id: true, deviceCode: true, name: true } },
        approver: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(records)
  } catch (error) {
    console.error('获取提交记录错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 管理员：获取待审批维修列表
export async function getPendingMaintenanceApprovals(req: AuthRequest, res: Response) {
  try {
    const { status } = req.query
    const where: any = {}
    if (status) where.status = status

    const approvals = await prisma.pendingMaintenance.findMany({
      where,
      include: {
        device: {
          select: {
            id: true,
            deviceCode: true,
            name: true,
            currentUserName: true,
            createdAt: true,
            hardware: { select: { macAddress: true } },
            currentUser: { select: { id: true, username: true } },
          },
        },
        submitter: { select: { id: true, username: true } },
        approver: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(approvals)
  } catch (error) {
    console.error('获取维修审批列表错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 管理员：获取维修审批详情
export async function getMaintenanceApprovalDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    const approval = await prisma.pendingMaintenance.findUnique({
      where: { id },
      include: {
        device: {
          select: {
            id: true,
            deviceCode: true,
            name: true,
            currentUserName: true,
            createdAt: true,
            hardware: { select: { macAddress: true } },
            currentUser: { select: { id: true, username: true } },
          },
        },
        submitter: { select: { id: true, username: true } },
        approver: { select: { id: true, username: true } },
      },
    })

    if (!approval) {
      res.status(404).json({ error: '记录不存在' })
      return
    }

    // 查询该设备的历史维修记录
    const maintenanceRecords = await prisma.deviceMaintenance.findMany({
      where: { deviceId: approval.deviceId },
      orderBy: { startDate: 'desc' },
      include: { user: { select: { id: true, username: true } } },
    })

    res.json({ ...approval, maintenanceRecords })
  } catch (error) {
    console.error('获取维修审批详情错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 管理员：审批通过
export async function approveMaintenance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId: approverId } = req

    const pending = await prisma.pendingMaintenance.findUnique({
      where: { id },
    })

    if (!pending) {
      res.status(404).json({ error: '记录不存在' })
      return
    }

    if (pending.status !== 'PENDING') {
      res.status(400).json({ error: '该记录已处理' })
      return
    }

    // 事务处理：创建维修记录 + 更新设备
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建实际的维修记录
      const record = await tx.deviceMaintenance.create({
        data: {
          deviceId: pending.deviceId,
          maintenanceType: pending.maintenanceType,
          description: pending.description,
          solution: pending.solution,
          cost: pending.cost,
          vendor: pending.vendor,
          startDate: pending.startDate,
          endDate: pending.endDate,
          operator: pending.submitterId, // 保留提交人作为操作人
        },
      })

      // 2. 更新设备状态为维修中
      await tx.device.update({
        where: { id: pending.deviceId },
        data: { status: 'REPAIR' },
      })

      // 3. 处理使用人变更（如果提供了当前使用人）
      // 优先匹配系统用户，未匹配则存为文本
      if (pending.currentUserName) {
        const targetUser = await tx.user.findFirst({
          where: { username: pending.currentUserName },
        })

        if (targetUser) {
          // 匹配到系统用户 → 结束旧记录、关联 userId、创建历史
          const device = await tx.device.findUnique({ where: { id: pending.deviceId } })
          if (device && device.currentUserId) {
            await tx.deviceHistoricalUser.updateMany({
              where: {
                deviceId: pending.deviceId,
                userId: device.currentUserId,
                endDate: null,
              },
              data: { endDate: new Date() },
            })
          }

          await tx.device.update({
            where: { id: pending.deviceId },
            data: { currentUserId: targetUser.id },
          })

          await tx.deviceHistoricalUser.create({
            data: {
              deviceId: pending.deviceId,
              userId: targetUser.id,
              changedBy: approverId!,
              changeReason: '维修分配',
              startDate: new Date(),
            },
          })
        } else {
          // 未匹配到系统用户 → 存为纯文本，并记录历史
          await tx.device.update({
            where: { id: pending.deviceId },
            data: { currentUserName: pending.currentUserName },
          })
          await tx.deviceHistoricalUser.create({
            data: {
              deviceId: pending.deviceId,
              userName: pending.currentUserName,
              changedBy: approverId!,
              changeReason: '维修分配',
              startDate: new Date(),
            },
          })
        }
      }

      return record
    })

    // 更新审批状态
    await prisma.pendingMaintenance.update({
      where: { id },
      data: { status: 'APPROVED', approverId },
    })

    res.json({ message: '维修记录审批通过' })
  } catch (error) {
    console.error('维修审批通过错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 管理员：审批拒绝
export async function rejectMaintenance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId: approverId } = req
    const { reason } = req.body

    const pending = await prisma.pendingMaintenance.findUnique({
      where: { id },
    })

    if (!pending) {
      res.status(404).json({ error: '记录不存在' })
      return
    }

    if (pending.status !== 'PENDING') {
      res.status(400).json({ error: '该记录已处理' })
      return
    }

    await prisma.pendingMaintenance.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason || '',
        approverId,
      },
    })

    res.json({ message: '维修记录已拒绝' })
  } catch (error) {
    console.error('维修审批拒绝错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

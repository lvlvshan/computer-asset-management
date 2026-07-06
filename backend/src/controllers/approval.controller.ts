// 审批管理控制器
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../prisma/client'

// ApprovalStatus 和 DeviceStatus 已改为字符串

// 获取待审批列表
export async function getPendingApprovals(req: AuthRequest, res: Response) {
  try {
    const { status } = req.query

    const where: any = {}
    if (status) {
      where.status = status
    }

    const approvals = await prisma.pendingApproval.findMany({
      where,
      include: {
        device: {
          select: {
            id: true,
            deviceCode: true,
            name: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(approvals)
  } catch (error) {
    console.error('获取审批列表错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 获取审批详情
export async function getApprovalDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    const approval = await prisma.pendingApproval.findUnique({
      where: { id },
      include: {
        device: {
          select: {
            id: true,
            deviceCode: true,
            name: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    if (!approval) {
      res.status(404).json({ error: '审批记录不存在' })
      return
    }

    res.json(approval)
  } catch (error) {
    console.error('获取审批详情错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 审批通过
export async function approveApproval(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId } = req

    const approval = await prisma.pendingApproval.findUnique({
      where: { id },
    })

    if (!approval) {
      res.status(404).json({ error: '审批记录不存在' })
      return
    }

    if (approval.status !== 'PENDING') {
      res.status(400).json({ error: '该审批记录已处理' })
      return
    }

    const hardwareData = JSON.parse(approval.hardwareData)
    const assetCode = hardwareData.assetCode?.trim() || `DEV${Date.now()}`

    // 辅助函数：将硬件字段转为字符串
    const toFieldString = (val: any): string => {
      if (!val) return ''
      if (typeof val === 'string') return val
      if (Array.isArray(val)) {
        return val.map((item: any) => {
          if (typeof item === 'object') return Object.values(item).filter(v => v != null).join(' ')
          return String(item)
        }).join(', ')
      }
      if (typeof val === 'object') return Object.values(val).filter(v => v != null).join(' ')
      return String(val)
    }

    // 事务处理：更新或创建设备和硬件信息
    const result = await prisma.$transaction(async (tx) => {
      let device

      if (approval.deviceId) {
        // ======== 同 MAC 已有设备 → 更新现有设备 ========
        const oldDevice = await tx.device.findUnique({ where: { id: approval.deviceId } })
        if (!oldDevice) {
          // 旧设备被删除，回退到创建新设备
          device = await tx.device.create({
            data: {
              deviceCode: assetCode,
              name: approval.deviceName || hardwareData.hostname || '未命名设备',
              status: 'IN_USE',
              location: hardwareData.location || approval.location || '',
            },
          })
          if (hardwareData.userName) {
            const existingUser = await tx.user.findFirst({ where: { username: hardwareData.userName } })
            if (existingUser) {
              await tx.device.update({ where: { id: device.id }, data: { currentUserId: existingUser.id } })
              await tx.deviceHistoricalUser.create({
                data: { deviceId: device.id, userId: existingUser.id, changedBy: userId!, changeReason: '分配', startDate: new Date() },
              })
            } else {
              await tx.device.update({ where: { id: device.id }, data: { currentUserName: hardwareData.userName } })
              await tx.deviceHistoricalUser.create({
                data: { deviceId: device.id, userName: hardwareData.userName, changedBy: userId!, changeReason: '分配', startDate: new Date() },
              })
            }
          }
          await tx.deviceHardware.create({
            data: {
              deviceId: device.id,
              cpu: hardwareData.cpu || '', memory: hardwareData.memory || '', disk: toFieldString(hardwareData.disk),
              gpu: toFieldString(hardwareData.gpu), networkCards: JSON.stringify(hardwareData.networkCards || []),
              motherboard: hardwareData.motherboard || '', os: hardwareData.os || '',
              macAddress: hardwareData.macAddress || '', submitterIp: hardwareData.submitterIp || approval.submitterIp || '',
            },
          })
          return { device, approval }
        }

        // 使用人变化处理：结束旧使用人记录，创建新使用人记录
        const newUserName = hardwareData.userName?.trim()
        if (newUserName && newUserName !== oldDevice.currentUserName) {
          // 结束旧使用人的当前历史
          await tx.deviceHistoricalUser.updateMany({
            where: { deviceId: oldDevice.id, endDate: null },
            data: { endDate: new Date() },
          })
          // 创建新使用人历史
          const existingUser = await tx.user.findFirst({ where: { username: newUserName } })
          if (existingUser) {
            await tx.deviceHistoricalUser.create({
              data: { deviceId: oldDevice.id, userId: existingUser.id, changedBy: userId!, changeReason: '分配', startDate: new Date() },
            })
          } else {
            await tx.deviceHistoricalUser.create({
              data: { deviceId: oldDevice.id, userName: newUserName, changedBy: userId!, changeReason: '分配', startDate: new Date() },
            })
          }
        }

        // 更新设备信息（部门以最新采集为准，使用人更新）
        device = await tx.device.update({
          where: { id: oldDevice.id },
          data: {
            deviceCode: assetCode,
            name: approval.deviceName || hardwareData.hostname || oldDevice.name,
            location: hardwareData.location || approval.location || oldDevice.location || '',
            currentUserName: newUserName || oldDevice.currentUserName,
          },
        })

        // 更新硬件配置（同设备只保留最新硬件快照）
        await tx.deviceHardware.update({
          where: { deviceId: oldDevice.id },
          data: {
            cpu: hardwareData.cpu || '', memory: hardwareData.memory || '', disk: toFieldString(hardwareData.disk),
            gpu: toFieldString(hardwareData.gpu), networkCards: JSON.stringify(hardwareData.networkCards || []),
            motherboard: hardwareData.motherboard || '', os: hardwareData.os || '',
            macAddress: hardwareData.macAddress || '', submitterIp: hardwareData.submitterIp || approval.submitterIp || '',
          },
        })
      } else {
        // ======== 新设备 → 创建新设备 ========
        device = await tx.device.create({
          data: {
            deviceCode: assetCode,
            name: approval.deviceName || hardwareData.hostname || '未命名设备',
            status: 'IN_USE',
            location: hardwareData.location || approval.location || '',
          },
        })

        // 设置设备使用人（如果提供了 userName）
        if (hardwareData.userName) {
          const existingUser = await tx.user.findFirst({
            where: { username: hardwareData.userName },
          })
          if (existingUser) {
            await tx.device.update({
              where: { id: device.id },
              data: { currentUserId: existingUser.id },
            })
            await tx.deviceHistoricalUser.create({
              data: { deviceId: device.id, userId: existingUser.id, changedBy: userId!, changeReason: '分配', startDate: new Date() },
            })
          } else {
            await tx.device.update({
              where: { id: device.id },
              data: { currentUserName: hardwareData.userName },
            })
            await tx.deviceHistoricalUser.create({
              data: { deviceId: device.id, userName: hardwareData.userName, changedBy: userId!, changeReason: '分配', startDate: new Date() },
            })
          }
          // 刷新 device 对象，确保返回的数据包含最新的使用人
          const refreshed = await tx.device.findUnique({ where: { id: device.id } })
          if (refreshed) device = refreshed
        }

        // 创建新的硬件信息
        await tx.deviceHardware.create({
          data: {
            deviceId: device.id,
            cpu: hardwareData.cpu || '', memory: hardwareData.memory || '', disk: toFieldString(hardwareData.disk),
            gpu: toFieldString(hardwareData.gpu), networkCards: JSON.stringify(hardwareData.networkCards || []),
            motherboard: hardwareData.motherboard || '', os: hardwareData.os || '',
            macAddress: hardwareData.macAddress || '', submitterIp: hardwareData.submitterIp || approval.submitterIp || '',
          },
        })
      }

      return { device, approval }
    })

    // 事务外更新审批状态（避免外键约束问题）
    await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: userId,
      },
    })

    res.json({ message: '审批通过', device: result.device })
  } catch (error) {
    console.error('审批通过错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 审批拒绝
export async function rejectApproval(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId, reason } = req.body

    const approval = await prisma.pendingApproval.findUnique({
      where: { id },
    })

    if (!approval) {
      res.status(404).json({ error: '审批记录不存在' })
      return
    }

    if (approval.status !== 'PENDING') {
      res.status(400).json({ error: '该审批记录已处理' })
      return
    }

    await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason,
        approverId: userId,
      },
    })

    res.json({ message: '审批拒绝' })
  } catch (error) {
    console.error('审批拒绝错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}
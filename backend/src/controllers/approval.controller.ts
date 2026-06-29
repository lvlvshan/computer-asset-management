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

    // 事务处理：创建设备和硬件信息
    const result = await prisma.$transaction(async (tx) => {
      // 每次审批都创建新设备，支持 MAC 分组展示
      const device = await tx.device.create({
        data: {
          deviceCode: assetCode,
          name: approval.deviceName || hardwareData.hostname || '未命名设备',
          status: 'IN_USE',
          location: hardwareData.location || approval.location || '',
        },
      })

      // 如果存在旧设备（同 MAC），将旧设备的使用人历史复制到新设备
      if (approval.deviceId) {
        const oldHistories = await tx.deviceHistoricalUser.findMany({
          where: { deviceId: approval.deviceId },
        })
        for (const h of oldHistories) {
          await tx.deviceHistoricalUser.create({
            data: {
              deviceId: device.id,
              userId: h.userId,
              changedBy: h.changedBy,
              changeReason: h.changeReason,
              startDate: h.startDate,
              endDate: h.endDate,
            },
          })
        }
      }

      // 设置设备使用人（如果提供了 userName）
      // 优先匹配系统用户，未匹配则存为文本
      if (hardwareData.userName) {
        const existingUser = await tx.user.findFirst({
          where: { username: hardwareData.userName },
        })
        if (existingUser) {
          // 匹配到系统用户 → 关联 userId 并记录历史
          await tx.device.update({
            where: { id: device.id },
            data: { currentUserId: existingUser.id },
          })
          await tx.deviceHistoricalUser.create({
            data: {
              deviceId: device.id,
              userId: existingUser.id,
              changedBy: userId!,
              changeReason: '分配',
              startDate: new Date(),
            },
          })
        } else {
          // 未匹配到系统用户 → 存为纯文本，并记录历史
          await tx.device.update({
            where: { id: device.id },
            data: { currentUserName: hardwareData.userName },
          })
          await tx.deviceHistoricalUser.create({
            data: {
              deviceId: device.id,
              userName: hardwareData.userName,
              changedBy: userId!,
              changeReason: '分配',
              startDate: new Date(),
            },
          })
        }
      }

      // 创建新的硬件信息
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

      await tx.deviceHardware.create({
        data: {
          deviceId: device.id,
          cpu: hardwareData.cpu || '',
          memory: hardwareData.memory || '',
          disk: toFieldString(hardwareData.disk),
          gpu: toFieldString(hardwareData.gpu),
          networkCards: JSON.stringify(hardwareData.networkCards || []),
          motherboard: hardwareData.motherboard || '',
          os: hardwareData.os || '',
          macAddress: hardwareData.macAddress || '',
          submitterIp: hardwareData.submitterIp || approval.submitterIp || '',
        },
      })

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
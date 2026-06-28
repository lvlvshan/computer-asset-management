// 设备管理控制器
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../prisma/client'
// DeviceStatus 和 MaintenanceType 已改为字符串，不再使用枚举

// 获取设备列表
export async function getDeviceList(req: AuthRequest, res: Response) {
  try {
    const { status, organization, currentUserId, search, location, macAddress, hardware, fromApprovalDate, toApprovalDate } = req.query

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (organization) {
      where.organization = { contains: organization as string }
    }

    if (currentUserId === 'null') {
      where.currentUserId = null
    } else if (currentUserId) {
      where.currentUserId = currentUserId
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { deviceCode: { contains: search as string } },
      ]
    }

    if (location) {
      where.location = { contains: location as string }
    }

    if (macAddress) {
      where.hardware = {
        macAddress: { contains: macAddress as string },
      }
    }

    if (hardware) {
      const hwSearch = { contains: hardware as string }
      if (where.hardware?.macAddress) {
        where.hardware.OR = [
          { macAddress: where.hardware.macAddress },
          { cpu: hwSearch },
          { memory: hwSearch },
          { disk: hwSearch },
          { gpu: hwSearch },
          { os: hwSearch },
        ]
        delete where.hardware.macAddress
      } else {
        where.hardware = {
          OR: [
            { cpu: hwSearch },
            { memory: hwSearch },
            { disk: hwSearch },
            { gpu: hwSearch },
            { os: hwSearch },
          ],
        }
      }
    }

    // 审批时间范围筛选
    if (fromApprovalDate || toApprovalDate) {
      where.createdAt = {}
      if (fromApprovalDate) where.createdAt.gte = new Date(fromApprovalDate as string)
      if (toApprovalDate) where.createdAt.lte = new Date(toApprovalDate as string)
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        currentUser: {
          select: { id: true, username: true },
        },
        hardware: {
          select: { cpu: true, memory: true, disk: true, gpu: true, macAddress: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(devices)
  } catch (error) {
    console.error('获取设备列表错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 获取设备详情
export async function getDeviceDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        currentUser: {
          select: { id: true, username: true },
        },
        hardware: true,
        historicalUsers: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        maintenanceRecords: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        pendingApprovals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!device) {
      res.status(404).json({ error: '设备不存在' })
      return
    }

    // 查找同一 MAC 的所有设备硬件版本（用于版本对比）
    let hardwareVersions: any[] = []
    if (device.hardware?.macAddress) {
      const mac = device.hardware.macAddress
      // 查找同一 MAC 的所有 DeviceHardware 记录，关联 Device
      const siblings = await prisma.deviceHardware.findMany({
        where: { macAddress: mac },
        include: {
          device: {
            select: { id: true, deviceCode: true, name: true, createdAt: true },
          },
        },
        orderBy: { collectedAt: 'desc' },
      })
      hardwareVersions = siblings.map(h => ({
        deviceId: h.device.id,
        deviceCode: h.device.deviceCode,
        deviceName: h.device.name,
        createdAt: h.device.createdAt,
        cpu: h.cpu,
        memory: h.memory,
        disk: h.disk,
        gpu: h.gpu,
        os: h.os,
        macAddress: h.macAddress,
        collectedAt: h.collectedAt,
        submitterIp: h.submitterIp,
      }))
    }

    res.json({ ...device, hardwareVersions })
  } catch (error) {
    console.error('获取设备详情错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 创建设备
export async function createDevice(req: AuthRequest, res: Response) {
  try {
    const { userId } = req
    const {
      deviceCode,
      name,
      status = 'IDLE',
      currentUserId,
      organization,
      location,
      purchaseDate,
      warrantyEnd,
    } = req.body

    // 检查资产编号是否重复
    const existing = await prisma.device.findFirst({ where: { deviceCode } })
    if (existing) {
      res.status(400).json({ error: '资产编号已存在' })
      return
    }

    const device = await prisma.device.create({
      data: {
        deviceCode,
        name,
        status: status,
        currentUserId,
        organization,
        location,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
      },
      include: {
        currentUser: {
          select: { id: true, username: true },
        },
      },
    })

    // 如果有初始使用人，记录历史（仅对有效用户 ID）
    if (currentUserId && currentUserId.length === 36) {
      await prisma.deviceHistoricalUser.create({
        data: {
          deviceId: device.id,
          userId: currentUserId,
          changedBy: userId!,
          changeReason: '新配',
          startDate: new Date(),
        },
      })
    }

    res.status(201).json(device)
  } catch (error) {
    console.error('创建设备错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 更新设备
export async function updateDevice(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const updateData: any = {}

    const allowedFields = ['name', 'status', 'organization', 'location', 'purchaseDate', 'warrantyEnd', 'currentUserName']
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (['purchaseDate', 'warrantyEnd'].includes(field)) {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null
        } else {
          updateData[field] = req.body[field]
        }
      }
    }

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
    })

    res.json(device)
  } catch (error) {
    console.error('更新设备错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 删除设备
export async function deleteDevice(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    await prisma.device.delete({
      where: { id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('删除设备错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 分配/变更使用人
export async function allocateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId, reason } = req.body
    const { userId: operatorId } = req

    if (!userId) {
      res.status(400).json({ error: '使用人 ID 不能为空' })
      return
    }

    // 获取当前设备信息
    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) {
      res.status(404).json({ error: '设备不存在' })
      return
    }

    // 如果有当前使用人，先结束其历史记录
    if (device.currentUserId) {
      await prisma.deviceHistoricalUser.updateMany({
        where: {
          deviceId: id,
          userId: device.currentUserId,
          endDate: null,
        },
        data: {
          endDate: new Date(),
        },
      })
    }

    // 创建新的使用人历史记录
    await prisma.deviceHistoricalUser.create({
      data: {
        deviceId: id,
        userId,
        changedBy: operatorId!,
        changeReason: reason || '分配',
        startDate: new Date(),
      },
    })

    // 更新设备当前使用人
    const updatedDevice = await prisma.device.update({
      where: { id },
      data: { currentUserId: userId, status: 'IN_USE' },
      include: {
        currentUser: {
          select: { id: true, username: true },
        },
      },
    })

    res.json(updatedDevice)
  } catch (error) {
    console.error('分配使用人错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 归还设备（移除使用人）
export async function returnDevice(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId: operatorId } = req

    const device = await prisma.device.findUnique({ where: { id } })
    if (!device) {
      res.status(404).json({ error: '设备不存在' })
      return
    }

    // 结束当前使用人的历史记录
    if (device.currentUserId) {
      await prisma.deviceHistoricalUser.updateMany({
        where: {
          deviceId: id,
          userId: device.currentUserId,
          endDate: null,
        },
        data: {
          endDate: new Date(),
          changeReason: '归还',
        },
      })
    }

    // 更新设备状态
    const updatedDevice = await prisma.device.update({
      where: { id },
      data: {
        currentUserId: null,
        status: 'IDLE',
      },
      include: {
        currentUser: {
          select: { id: true, username: true },
        },
      },
    })

    res.json(updatedDevice)
  } catch (error) {
    console.error('归还设备错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 添加维修记录
export async function addMaintenanceRecord(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { userId: operatorId } = req
    const {
      maintenanceType,
      description,
      solution,
      cost,
      vendor,
      startDate,
    } = req.body

    const record = await prisma.deviceMaintenance.create({
      data: {
        deviceId: id,
        maintenanceType: maintenanceType,
        description,
        solution,
        cost: cost ? parseFloat(cost) : null,
        vendor,
        startDate: new Date(startDate),
        operator: operatorId!,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    })

    // 更新设备状态为维修中
    await prisma.device.update({
      where: { id },
      data: { status: 'REPAIR' },
    })

    res.status(201).json(record)
  } catch (error) {
    console.error('添加维修记录错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 完成维修
export async function completeMaintenance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { solution, endDate } = req.body

    const record = await prisma.deviceMaintenance.update({
      where: { id },
      data: {
        solution,
        endDate: endDate ? new Date(endDate) : new Date(),
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    })

    // 更新设备状态
    await prisma.device.update({
      where: { id: record.deviceId },
      data: { status: 'IN_USE' },
    })

    res.json(record)
  } catch (error) {
    console.error('完成维修错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 批量更新设备
export async function batchUpdateDevices(req: AuthRequest, res: Response) {
  try {
    const { ids, updates } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请选择要更新的设备' })
      return
    }

    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: '请提供要修改的字段' })
      return
    }

    // 只允许修改以下字段
    const allowedFields = ['organization', 'location', 'status']
    const cleanUpdates: any = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
        cleanUpdates[field] = updates[field]
      }
    }

    if (Object.keys(cleanUpdates).length === 0) {
      res.status(400).json({ error: '没有有效字段需要更新' })
      return
    }

    const result = await prisma.device.updateMany({
      where: { id: { in: ids } },
      data: cleanUpdates,
    })

    res.json({
      message: `成功更新 ${result.count} 台设备`,
      count: result.count,
    })
  } catch (error) {
    console.error('批量更新设备错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}
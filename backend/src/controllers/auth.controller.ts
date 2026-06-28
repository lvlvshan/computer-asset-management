// 认证控制器
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../prisma/client'
import { AuthRequest, JWT_SECRET } from '../middlewares/auth.middleware'

// 用户登录
export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('登录错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 获取当前用户信息
export async function getCurrentUser(req: Request, res: Response) {
  try {
    // req.userId 由 authMiddleware 设置
    const { userId } = req as any

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    res.json(user)
  } catch (error) {
    console.error('获取用户信息错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 获取用户列表（仅管理员）
export async function getUserList(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(users)
  } catch (error) {
    console.error('获取用户列表错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 创建用户（仅管理员）
export async function createUser(req: Request, res: Response) {
  try {
    const { username, password, role } = req.body

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }

    // 检查用户名是否存在
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      res.status(400).json({ error: '用户名已存在' })
      return
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role || 'STAFF',
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    })

    res.status(201).json(user)
  } catch (error) {
    console.error('创建用户错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 修改密码
export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const { userId } = req
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: '旧密码和新密码不能为空' })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: '新密码长度不能少于6位' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    const isValid = await bcrypt.compare(oldPassword, user.password)
    if (!isValid) {
      res.status(400).json({ error: '旧密码错误' })
      return
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    res.json({ message: '密码修改成功' })
  } catch (error) {
    console.error('修改密码错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 更新用户（管理员）
export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { username, role } = req.body

    // 检查用户是否存在
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    // 检查用户名是否被占用
    if (username && username !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) {
        res.status(400).json({ error: '用户名已存在' })
        return
      }
    }

    const updateData: any = {}
    if (username) updateData.username = username
    if (role) updateData.role = role

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, role: true, createdAt: true },
    })

    res.json(updated)
  } catch (error) {
    console.error('更新用户错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 删除用户（管理员）
export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const currentUserId = req.userId

    if (id === currentUserId) {
      res.status(400).json({ error: '不能删除自己' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    // 事务中先清理所有关联数据，再删除用户
    await prisma.$transaction([
      // 1. 设备当前使用人置空
      prisma.device.updateMany({
        where: { currentUserId: id },
        data: { currentUserId: null },
      }),
      // 2. 删除使用历史记录
      prisma.deviceHistoricalUser.deleteMany({
        where: { userId: id },
      }),
      // 3. 删除维修记录
      prisma.deviceMaintenance.deleteMany({
        where: { operator: id },
      }),
      // 4. 待审批采集数据审批人置空
      prisma.pendingApproval.updateMany({
        where: { approverId: id },
        data: { approverId: null },
      }),
      // 5. 删除待审批维修中 submitter 为当前用户的记录
      prisma.pendingMaintenance.deleteMany({
        where: { submitterId: id },
      }),
      // 6. 待审批维修审批人置空
      prisma.pendingMaintenance.updateMany({
        where: { approverId: id },
        data: { approverId: null },
      }),
      // 7. 最后删除用户
      prisma.user.delete({ where: { id } }),
    ])

    res.json({ message: '用户已删除' })
  } catch (error) {
    console.error('删除用户错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 重置密码（管理员）
export async function resetPassword(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ error: '用户不存在' })
      return
    }

    const hashedPassword = await bcrypt.hash('123456', 10)
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    res.json({ message: '密码已重置为 123456' })
  } catch (error) {
    console.error('重置密码错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}
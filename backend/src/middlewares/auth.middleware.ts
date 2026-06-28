// JWT 认证中间件
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' })
    return
  }

  const token = authHeader.substring(7)

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string }
    req.userId = payload.userId
    req.userRole = payload.role
    next()
  } catch (error) {
    res.status(401).json({ error: '认证令牌无效或已过期' })
  }
}

// 管理员权限中间件
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: '需要管理员权限' })
    return
  }
  next()
}

// 维修人员权限中间件
export function maintenanceMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'MAINTENANCE') {
    res.status(403).json({ error: '需要维修人员权限' })
    return
  }
  next()
}

export { JWT_SECRET }
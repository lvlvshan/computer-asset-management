// 后端主入口文件
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import prisma from './prisma/client'
import routes from './routes'

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// 中间件 - 显式设置 UTF-8 编码
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 注册路由
app.use('/api', routes)

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// 生产环境提供前端静态文件
const publicPath = path.resolve(__dirname, '../public')
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath))
  // SPA fallback — 非 API 请求返回 index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'))
  })
}

// 启动服务器 — 先初始化数据库默认数据，再监听端口
async function start() {
  try {
    // 创建默认管理员账户（如果没有）
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await prisma.user.create({
        data: { username: 'admin', password: hashedPassword, role: 'ADMIN' },
      })
      console.log('  - 管理员：admin / admin123')
    }

    // 创建测试普通用户（如果没有）
    const existingStaff = await prisma.user.findUnique({ where: { username: 'staff' } })
    if (!existingStaff) {
      const hashedStaffPassword = await bcrypt.hash('staff123', 10)
      await prisma.user.create({
        data: { username: 'staff', password: hashedStaffPassword, role: 'STAFF' },
      })
      console.log('  - 普通用户：staff / staff123')
    }

    // 创建测试维修人员（如果没有）
    const existingMaint = await prisma.user.findUnique({ where: { username: 'maintenance' } })
    if (!existingMaint) {
      const hashedMaintPassword = await bcrypt.hash('maint123', 10)
      await prisma.user.create({
        data: { username: 'maintenance', password: hashedMaintPassword, role: 'MAINTENANCE' },
      })
      console.log('  - 维修人员：maintenance / maint123')
    }
  } catch (e) {
    console.log('数据库初始化（默认用户已存在可忽略）:', (e as Error).message)
  }

  // 启动服务器
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器运行在 http://0.0.0.0:${PORT}`)
  })
}

start()
export default app
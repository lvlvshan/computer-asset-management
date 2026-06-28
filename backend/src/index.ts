// 后端主入口文件
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
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

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`)
})

export default app
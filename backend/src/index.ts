// 后端主入口文件
import express from 'express'
import cors from 'cors'
import routes from './routes'

const app = express()
const PORT = process.env.PORT || 3000

// 中间件 - 显式设置 UTF-8 编码
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 注册路由
app.use('/api', routes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`)
})

export default app
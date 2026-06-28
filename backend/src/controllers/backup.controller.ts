// 数据库备份恢复控制器
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import path from 'path'
import fs from 'fs'
import multer from 'multer'

const DB_PATH = path.resolve(__dirname, '../../prisma/dev.db')

// Multer 配置
const upload = multer({ storage: multer.memoryStorage() })
export const uploadMiddleware = upload.single('database')

// 导出数据库备份
export async function exportDatabase(req: AuthRequest, res: Response) {
  try {
    if (!fs.existsSync(DB_PATH)) {
      res.status(404).json({ error: '数据库文件不存在' })
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}.db`

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const readStream = fs.createReadStream(DB_PATH)
    readStream.pipe(res)
  } catch (error) {
    console.error('导出数据库错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 导入数据库恢复
export async function importDatabase(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请选择要恢复的数据库文件' })
      return
    }

    // 恢复前自动备份当前数据库
    const preRestoreBackup = path.resolve(
      __dirname,
      `../../prisma/dev-pre-${Date.now()}.db`
    )
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, preRestoreBackup)
    }

    // 写入上传的数据库文件
    fs.writeFileSync(DB_PATH, req.file.buffer)

    res.json({
      message: '数据库恢复成功，请重新启动后端服务以确保数据一致性',
      backupFile: path.basename(preRestoreBackup),
    })
  } catch (error) {
    console.error('导入数据库错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

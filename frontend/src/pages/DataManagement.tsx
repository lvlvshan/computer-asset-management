// 管理员 - 数据备份与恢复
import React, { useState } from 'react'
import { Card, Button, Space, message, Alert, Divider, Upload } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { backupApi } from '../api'

const DataManagement: React.FC = () => {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await backupApi.exportDatabase()
      const blob = new Blob([response.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = response.headers['content-disposition'] || ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : `backup-${Date.now()}.db`
      a.click()
      URL.revokeObjectURL(url)
      message.success('数据库备份已下载')
    } catch (err: any) {
      message.error(err.response?.data?.error || '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const res = await backupApi.importDatabase(file)
      message.success(res.data.message || '恢复成功')
    } catch (err: any) {
      message.error(err.response?.data?.error || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>数据管理</h2>

      <Card title="备份与恢复" style={{ maxWidth: 600 }}>
        <Alert
          message="注意事项"
          description="恢复操作将覆盖当前所有数据！建议在恢复前先点击「导出数据库备份」保存当前数据。恢复后请重新启动后端服务。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
            block
          >
            导出数据库备份
          </Button>

          <Divider plain>或</Divider>

          <Upload
            accept=".db"
            showUploadList={false}
            beforeUpload={(file) => {
              handleImport(file)
              return false
            }}
          >
            <Button icon={<UploadOutlined />} loading={importing} block>
              导入数据库文件
            </Button>
          </Upload>
        </Space>
      </Card>
    </div>
  )
}

export default DataManagement

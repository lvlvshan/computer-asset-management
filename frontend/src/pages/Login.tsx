// 登录页面 - 添加设备信息采集功能
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Divider } from 'antd'
import { UserOutlined, LockOutlined, WindowsOutlined } from '@ant-design/icons'
import { authApi, scanApi } from '../api'
import { useUserStore } from '../stores/userStore'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const setUser = useUserStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const response = await authApi.login(values)
      const { token, user } = response.data

      localStorage.setItem('token', token)
      localStorage.setItem('userRole', user.role)
      localStorage.setItem('userId', user.id)
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)

      message.success('登录成功')
      navigate('/')
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  // 打开本地采集工具 - 下载 BAT 和 PS1 文件（PS1 从后端动态获取）
  const openLocalCollector = async () => {
    try {
      // 从后端获取最新的 PowerShell 脚本
      const response = await scanApi.getWindowsScript()
      const ps1Content = response.data

      const batContent = `@echo off
chcp 65001 >nul
cls
echo ========================================
echo   Asset Collection Tool
echo ========================================
echo.
echo Starting hardware collection...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0collect_hardware.ps1"
echo.
`

      const blobBat = new Blob([batContent], { type: 'text/plain;charset=utf-8' })
      const blobPs1 = new Blob([ps1Content], { type: 'text/plain;charset=utf-8' })

      // 下载批处理文件
      const linkBat = document.createElement('a')
      linkBat.href = URL.createObjectURL(blobBat)
      linkBat.download = 'collect_hardware.bat'
      linkBat.click()
      URL.revokeObjectURL(linkBat.href)

      // 下载 PowerShell 脚本
      setTimeout(() => {
        const linkPs1 = document.createElement('a')
        linkPs1.href = URL.createObjectURL(blobPs1)
        linkPs1.download = 'collect_hardware.ps1'
        linkPs1.click()
        URL.revokeObjectURL(linkPs1.href)
        message.success('采集工具已下载！请将两个文件放在同一文件夹，双击运行 .bat 文件')
      }, 500)

      message.info('正在下载采集工具...')
    } catch (error) {
      message.error('下载失败：' + (error as any).message)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, margin: 0, color: '#333' }}>电脑资产管理系统</h1>
          <p style={{ color: '#999', margin: '8px 0 0' }}>请登录</p>
        </div>

        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
          <p style={{ margin: '4px 0' }}>默认管理员：admin / admin123</p>
          <p style={{ margin: '4px 0' }}>普通用户：staff / staff123</p>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            <WindowsOutlined /> 上报新设备？下载采集工具
          </p>
          <Button
            type="default"
            icon={<WindowsOutlined />}
            onClick={openLocalCollector}
            block
          >
            下载采集工具 (BAT + PS1 文件)
          </Button>
          <p style={{ fontSize: 11, color: '#999', margin: '12px 0 0' }}>
            下载后请将两个文件放在同一文件夹，双击运行 .bat 文件
          </p>
          <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
            运行后需输入：使用人、设备所在地、资产编号
          </p>
          <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
            采集完成后自动上报，3 秒后关闭窗口
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Login
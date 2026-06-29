// 主布局组件
import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Modal, Form, Input, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  DesktopOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  LogoutOutlined,
  UserOutlined,
  ToolOutlined,
  DatabaseOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useUserStore } from '../stores/userStore'
import { authApi, approvalApi, maintenanceApi } from '../api'
import ErrorBoundary from '../components/ErrorBoundary'

const { Header, Content, Sider } = AntLayout

const Layout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useUserStore((state) => state.user)
  const setUser = useUserStore((state) => state.setUser)
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pwForm] = Form.useForm()
  const [pwLoading, setPwLoading] = useState(false)

  // 从 localStorage 恢复用户信息
  useEffect(() => {
    if (!user) {
      const storedUser = localStorage.getItem('user')
      const storedRole = localStorage.getItem('userRole')
      if (storedUser && storedRole) {
        try {
          const parsedUser = JSON.parse(storedUser)
          setUser({ ...parsedUser, role: storedRole })
        } catch (e) {
          // localStorage 数据损坏，清除
          localStorage.removeItem('user')
          localStorage.removeItem('userRole')
          localStorage.removeItem('token')
        }
      }
    }
  }, [])

  // 获取管理员待审批数量
  const { data: pendingApprovals = 0 } = useQuery({
    queryKey: ['pending-counts', 'approvals'],
    queryFn: () => approvalApi.getList({ status: 'PENDING' }).then((r) => r.data.length),
    refetchInterval: 30000,
    enabled: user?.role === 'ADMIN',
  })

  const { data: pendingMaintenance = 0 } = useQuery({
    queryKey: ['pending-counts', 'maintenance'],
    queryFn: () => maintenanceApi.getApprovals({ status: 'PENDING' }).then((r) => r.data.length),
    refetchInterval: 30000,
    enabled: user?.role === 'ADMIN',
  })

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('userRole')
    setUser(null)
    navigate('/login')
  }

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setPwLoading(true)
    try {
      await authApi.changePassword(values)
      message.success('密码修改成功')
      setPwModalOpen(false)
      pwForm.resetFields()
    } catch (err: any) {
      message.error(err.response?.data?.error || '修改失败')
    } finally {
      setPwLoading(false)
    }
  }

  const getMenuItems = () => {
    const role = user?.role
    const items: { key: string; icon: React.ReactNode; label: React.ReactNode }[] = []

    if (role === 'ADMIN' || role === 'STAFF') {
      items.push({ key: '/devices', icon: <DesktopOutlined />, label: '设备管理' })
    }

    if (role === 'ADMIN') {
      items.push({
        key: '/approvals',
        icon: <CheckCircleOutlined />,
        label: pendingApprovals > 0 ? `采集审批 (${pendingApprovals})` : '采集审批',
      })
      items.push({
        key: '/maintenance/approvals',
        icon: <ToolOutlined />,
        label: pendingMaintenance > 0 ? `维修审批 (${pendingMaintenance})` : '维修审批',
      })
      items.push({ key: '/users', icon: <UserOutlined />, label: '用户管理' })
      items.push({ key: '/data-management', icon: <DatabaseOutlined />, label: '数据管理' })
    }

    if (role === 'MAINTENANCE') {
      items.push({ key: '/maintenance/devices', icon: <ToolOutlined />, label: '维修管理' })
      items.push({ key: '/maintenance/my-submissions', icon: <FileTextOutlined />, label: '我的提交' })
    }

    return items
  }

  const menuItems = getMenuItems()

  const userMenuItems = [
    {
      key: 'password',
      icon: <KeyOutlined />,
      label: '修改密码',
      onClick: () => setPwModalOpen(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible defaultCollapsed={false} width={200}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#001529',
        }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>资产管理系统</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => navigate(item.key),
          }))}
        />
      </Sider>
      <AntLayout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <div />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user?.username}</span>
              {user?.role === 'ADMIN' && (
                <span style={{
                  fontSize: 12,
                  background: '#1890ff',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}>
                  管理员
                </span>
              )}
              {user?.role === 'MAINTENANCE' && (
                <span style={{
                  fontSize: 12,
                  background: '#fa8c16',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}>
                  维修人员
                </span>
              )}
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 4 }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </AntLayout>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={pwModalOpen}
        onCancel={() => { setPwModalOpen(false); pwForm.resetFields() }}
        onOk={() => pwForm.submit()}
        confirmLoading={pwLoading}
        destroyOnClose
      >
        <Form form={pwForm} layout="vertical" onFinish={handleChangePassword} style={{ marginTop: 16 }}>
          <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="输入当前密码" autoFocus />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码长度不能少于6位' },
          ]}>
            <Input.Password placeholder="输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </AntLayout>
  )
}

export default Layout
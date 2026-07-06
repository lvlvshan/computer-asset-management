// 用户管理页面（管理员）
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Card } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { userApi } from '../api'

const roleMap: Record<string, { text: string; color: string }> = {
  ADMIN: { text: '管理员', color: 'red' },
  STAFF: { text: '普通用户', color: 'blue' },
  MAINTENANCE: { text: '维修人员', color: 'orange' },
}

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getList().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role: string }) => userApi.create(data),
    onSuccess: () => {
      message.success('用户创建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { username?: string; role?: string } }) => userApi.update(id, data),
    onSuccess: () => {
      message.success('用户信息已更新')
      setEditModalOpen(false)
      setEditUser(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      message.success('用户已删除')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '删除失败')
    },
  })

  const resetPwdMutation = useMutation({
    mutationFn: (id: string) => userApi.resetPassword(id),
    onSuccess: () => {
      message.success('密码已重置为 123456')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '重置失败')
    },
  })

  const currentUserId = localStorage.getItem('userId')

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      sorter: (a: any, b: any) => a.username.localeCompare(b.username),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const info = roleMap[role] || { text: role, color: 'default' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
      sorter: (a: any, b: any) => a.role.localeCompare(b.role),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditUser(record)
              editForm.setFieldsValue({ username: record.username, role: record.role })
              setEditModalOpen(true)
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认重置密码"
            description={`将 ${record.username} 的密码重置为 123456`}
            onConfirm={() => resetPwdMutation.mutate(record.id)}
          >
            <Button type="link" size="small">重置密码</Button>
          </Popconfirm>
          {record.id !== currentUserId && (
            <Popconfirm
              title="确认删除"
              description={`确定删除用户 ${record.username}？此操作不可恢复。`}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateModalOpen(true) }}>
          新增用户
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
          loading={isLoading}
          rowKey="id"
          pagination={{
            showSizeChanger: {
              options: [
                { value: 10, label: '10 条/页' },
                { value: 20, label: '20 条/页' },
                { value: 50, label: '50 条/页' },
                { value: 100, label: '100 条/页' },
                { value: 999999, label: '所有' },
              ],
            },
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            defaultPageSize: 20,
          }}
        />
      </Card>

      {/* 新增用户 Modal */}
      <Modal
        title="新增用户"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="输入用户名" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码长度不能少于6位' },
          ]}>
            <Input.Password placeholder="输入密码（至少6位）" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色">
              <Select.Option value="ADMIN">管理员</Select.Option>
              <Select.Option value="STAFF">普通用户</Select.Option>
              <Select.Option value="MAINTENANCE">维修人员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户 Modal */}
      <Modal
        title="编辑用户"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditUser(null) }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate({ id: editUser.id, data: values })}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="输入用户名" autoFocus />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色">
              <Select.Option value="ADMIN">管理员</Select.Option>
              <Select.Option value="STAFF">普通用户</Select.Option>
              <Select.Option value="MAINTENANCE">维修人员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement

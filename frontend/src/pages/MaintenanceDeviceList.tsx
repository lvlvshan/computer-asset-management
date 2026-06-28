// 维修人员 - 设备列表
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Table, Button, Input, Select, Space, Tag } from 'antd'
import { SearchOutlined, ToolOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { maintenanceApi } from '../api'

const statusMap: Record<string, { text: string; color: string }> = {
  IN_USE: { text: '使用中', color: 'green' },
  IDLE: { text: '闲置', color: 'blue' },
  REPAIR: { text: '维修中', color: 'orange' },
  SCRAPPED: { text: '已报废', color: 'red' },
}

const MaintenanceDeviceList: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>()

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['maintenance-devices', { status: statusFilter, search }],
    queryFn: () => maintenanceApi.getDevices({ status: statusFilter, search }).then((r) => r.data),
  })

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'deviceCode',
      key: 'deviceCode',
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const info = statusMap[status] || { text: status, color: 'default' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '当前使用人',
      key: 'currentUser',
      render: (_: unknown, record: any) => record.currentUserName || record.currentUser?.username || '-',
    },
    {
      title: '部门',
      dataIndex: 'organization',
      key: 'organization',
      render: (org?: string) => org || '-',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      render: (loc?: string) => loc || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: any) => (
        <Button
          type="primary"
          size="small"
          icon={<ToolOutlined />}
          onClick={() => navigate(`/maintenance/devices/${record.id}/maintenance`)}
        >
          提交维修
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>维修管理</h2>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="搜索设备名称或编号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="REPAIR">维修中</Select.Option>
            <Select.Option value="IN_USE">使用中</Select.Option>
            <Select.Option value="IDLE">闲置</Select.Option>
            <Select.Option value="SCRAPPED">已报废</Select.Option>
          </Select>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={devices}
        loading={isLoading}
        rowKey="id"
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          defaultPageSize: 20,
        }}
      />
    </div>
  )
}

export default MaintenanceDeviceList

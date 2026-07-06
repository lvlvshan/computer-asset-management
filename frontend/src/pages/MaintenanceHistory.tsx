// 维修人员 - 我的提交记录
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Empty } from 'antd'
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { maintenanceApi } from '../api'

const statusConfig: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待审批', color: 'orange', icon: <ClockCircleOutlined /> },
  APPROVED: { text: '已通过', color: 'green', icon: <CheckCircleOutlined /> },
  REJECTED: { text: '已拒绝', color: 'red', icon: <CloseCircleOutlined /> },
}

const typeMap: Record<string, string> = {
  HARDWARE: '硬件维修',
  SOFTWARE: '软件维护',
  OTHER: '其他',
}

const MaintenanceHistory: React.FC = () => {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['my-maintenance-submissions'],
    queryFn: () => maintenanceApi.getMySubmissions().then((r) => r.data),
  })

  const columns = [
    {
      title: '设备',
      key: 'device',
      render: (_: unknown, record: any) =>
        record.device ? `${record.device.deviceCode} - ${record.device.name}` : '-',
    },
    {
      title: '维修类型',
      dataIndex: 'maintenanceType',
      key: 'maintenanceType',
      render: (type: string) => typeMap[type] || type,
    },
    {
      title: '故障描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const cfg = statusConfig[status] || { text: status, color: 'default', icon: null }
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>
      },
    },
    {
      title: '审批人',
      key: 'approver',
      render: (_: unknown, record: any) => record.approver?.username || '-',
    },
    {
      title: '拒绝原因',
      key: 'rejectedReason',
      render: (_: unknown, record: any) => record.rejectedReason || '-',
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ]

  if (!isLoading && submissions.length === 0) {
    return (
      <div>
        <h2 style={{ marginBottom: 16 }}>我的提交</h2>
        <Empty description="暂无提交记录" />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>我的提交</h2>
      <Table
        columns={columns}
        dataSource={submissions}
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
    </div>
  )
}

export default MaintenanceHistory

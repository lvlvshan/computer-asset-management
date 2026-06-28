// 管理员 - 维修审批
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Tag, Space, Modal, Input, message, Tabs, Descriptions, Card, Drawer, Empty } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
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

const MaintenanceApprovalList: React.FC = () => {
  const queryClient = useQueryClient()
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState<any>(null)

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['maintenance-approvals'],
    queryFn: () => maintenanceApi.getApprovals().then((r) => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.approve(id),
    onSuccess: () => {
      message.success('审批通过')
      queryClient.invalidateQueries({ queryKey: ['maintenance-approvals'] })
    },
    onError: (err: any) => message.error(err.response?.data?.error || '操作失败'),
  })

  const rejectMutation = useMutation({
    mutationFn: (params: { id: string; reason: string }) =>
      maintenanceApi.reject(params.id, { reason: params.reason }),
    onSuccess: () => {
      message.success('已拒绝')
      setRejectModalOpen(false)
      setRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['maintenance-approvals'] })
    },
    onError: (err: any) => message.error(err.response?.data?.error || '操作失败'),
  })

  const pendingItems = approvals.filter((a: any) => a.status === 'PENDING')
  const historyItems = approvals.filter((a: any) => a.status !== 'PENDING')

  const showDetail = (record: any) => {
    setDetailRecord(record)
    setDrawerVisible(true)
  }

  const handleApprove = (id: string) => {
    Modal.confirm({
      title: '确认通过',
      content: '确认通过该维修申请？通过后将创建维修记录并更新设备状态。',
      onOk: () => approveMutation.mutate(id),
    })
  }

  const pendingColumns = [
    { title: '设备', key: 'device', render: (_: unknown, r: any) => r.device ? `${r.device.deviceCode} - ${r.device.name}` : '-' },
    { title: '维修类型', dataIndex: 'maintenanceType', key: 'type', render: (t: string) => typeMap[t] || t },
    { title: '故障描述', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '提交人', key: 'submitter', render: (_: unknown, r: any) => r.submitter?.username || '-' },
    { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: any) => (
        <Space>
          <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>
            通过
          </Button>
          <Button size="small" icon={<CloseOutlined />} onClick={() => { setSelectedId(record.id); setRejectModalOpen(true) }}>
            拒绝
          </Button>
          <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ]

  const historyColumns = [
    { title: '设备', key: 'device', render: (_: unknown, r: any) => r.device ? `${r.device.deviceCode} - ${r.device.name}` : '-' },
    { title: '维修类型', dataIndex: 'maintenanceType', key: 'type', render: (t: string) => typeMap[t] || t },
    { title: '故障描述', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '提交人', key: 'submitter', render: (_: unknown, r: any) => r.submitter?.username || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const cfg = statusConfig[s] || {}
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>
      },
    },
    { title: '审批人', key: 'approver', render: (_: unknown, r: any) => r.approver?.username || '-' },
    { title: '拒绝原因', key: 'reason', render: (_: unknown, r: any) => r.rejectedReason || '-' },
    { title: '处理时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (d: string) => d ? new Date(d).toLocaleString() : '-' },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: any) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>详情</Button>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>维修审批</h2>
      <Tabs defaultActiveKey="pending">
        <Tabs.TabPane tab={`待审批 (${pendingItems.length})`} key="pending">
          <Table
            columns={pendingColumns}
            dataSource={pendingItems}
            loading={isLoading}
            rowKey="id"
            pagination={{ showTotal: (total) => `共 ${total} 条`, defaultPageSize: 20 }}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={`已审批 (${historyItems.length})`} key="history">
          <Table
            columns={historyColumns}
            dataSource={historyItems}
            loading={isLoading}
            rowKey="id"
            pagination={{ showTotal: (total) => `共 ${total} 条`, defaultPageSize: 20 }}
          />
        </Tabs.TabPane>
      </Tabs>

      <Drawer
        title="维修申请详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={500}
      >
        {detailRecord ? (
          <>
            <Card title="设备信息" size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="设备">
                  {detailRecord.device
                    ? `${detailRecord.device.deviceCode} - ${detailRecord.device.name}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="提交人">
                  {detailRecord.submitter?.username || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Card title="维修内容" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="维修类型">
                  {typeMap[detailRecord.maintenanceType] || detailRecord.maintenanceType}
                </Descriptions.Item>
                <Descriptions.Item label="故障描述">{detailRecord.description}</Descriptions.Item>
                <Descriptions.Item label="处理方案">{detailRecord.solution || '-'}</Descriptions.Item>
                <Descriptions.Item label="送修日期">
                  {new Date(detailRecord.startDate).toLocaleDateString()}
                </Descriptions.Item>
                <Descriptions.Item label="修复日期">
                  {detailRecord.endDate ? new Date(detailRecord.endDate).toLocaleDateString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="维修商">{detailRecord.vendor || '-'}</Descriptions.Item>
                <Descriptions.Item label="费用">
                  {detailRecord.cost ? `¥${detailRecord.cost}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="新使用人（自由填写）">
                  {detailRecord.currentUserName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  {(() => {
                    const cfg = statusConfig[detailRecord.status] || {}
                    return <Tag color={cfg.color}>{cfg.text}</Tag>
                  })()}
                </Descriptions.Item>
                {detailRecord.rejectedReason && (
                  <Descriptions.Item label="拒绝原因">{detailRecord.rejectedReason}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {detailRecord.status === 'PENDING' && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => { setDrawerVisible(false); handleApprove(detailRecord.id) }}
                  >
                    通过
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={() => { setDrawerVisible(false); setSelectedId(detailRecord.id); setRejectModalOpen(true) }}
                  >
                    拒绝
                  </Button>
                </Space>
              </div>
            )}
          </>
        ) : (
          <Empty />
        )}
      </Drawer>

      <Modal
        title="拒绝原因"
        open={rejectModalOpen}
        onOk={() => {
          if (!rejectReason.trim()) {
            message.error('请填写拒绝原因')
            return
          }
          rejectMutation.mutate({ id: selectedId!, reason: rejectReason })
        }}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); setSelectedId(null) }}
        confirmLoading={rejectMutation.isPending}
      >
        <Input.TextArea
          rows={3}
          placeholder="请填写拒绝原因（必填）"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default MaintenanceApprovalList

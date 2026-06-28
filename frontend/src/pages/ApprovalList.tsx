// 审批列表页面 - 分类显示
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  message,
  Tabs,
  Typography,
  Drawer,
  Descriptions,
  Card,
  Empty,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { approvalApi, deviceApi } from '../api'

const { Text } = Typography

function formatHardwareField(value: any): string {
  if (!value) return '-'
  if (Array.isArray(value)) {
    return value.map((item: any) => {
      if (typeof item === 'object') {
        const parts: string[] = []
        if (item.Model) parts.push(item.Model)
        if (item.SizeGB) parts.push(`${item.SizeGB}GB`)
        if (item.Name) parts.push(item.Name)
        if (parts.length === 0) parts.push(...Object.values(item).map(String))
        return parts.join(' ')
      }
      return String(item)
    }).join(', ')
  }
  if (typeof value === 'object') {
    const parts: string[] = []
    if (value.Model) parts.push(value.Model)
    if (value.SizeGB) parts.push(`${value.SizeGB}GB`)
    if (value.Name) parts.push(value.Name)
    if (parts.length === 0) parts.push(...Object.values(value).map(String))
    return parts.join(' ')
  }
  return String(value)
}

const statusMap: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待审批', color: 'orange' },
  APPROVED: { text: '已通过', color: 'green' },
  REJECTED: { text: '已拒绝', color: 'red' },
}

const ApprovalList: React.FC = () => {
  const queryClient = useQueryClient()
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('pending')
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [currentRecord, setCurrentRecord] = useState<any>(null)

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalApi.getList().then((r) => r.data),
  })

  // 分类数据
  const pendingApprovals = approvals.filter((a: any) => a.status === 'PENDING')
  const approvedApprovals = approvals.filter((a: any) => a.status === 'APPROVED')
  const rejectedApprovals = approvals.filter((a: any) => a.status === 'REJECTED')

  const allApprovals = [...approvedApprovals, ...rejectedApprovals]

  // 审批通过
  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalApi.approve(id),
    onSuccess: () => {
      message.success('审批通过')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setDetailVisible(false)
      setCurrentRecord(null)
      setSelectedDevice(null)
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '审批失败')
    },
  })

  // 审批拒绝
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalApi.reject(id, { reason }),
    onSuccess: () => {
      message.success('已拒绝')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setRejectModalVisible(false)
      setCurrentId(null)
      setRejectReason('')
      setDetailVisible(false)
      setCurrentRecord(null)
      setSelectedDevice(null)
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '操作失败')
    },
  })

  const handleApprove = (id: string) => {
    Modal.confirm({
      title: '确认通过',
      content: '确定要通过这条审批吗？设备将正式入库。',
      onOk: () => approveMutation.mutate(id),
    })
  }

  const handleReject = (id: string) => {
    setCurrentId(id)
    setRejectModalVisible(true)
  }

  const confirmReject = () => {
    if (currentId && rejectReason.trim()) {
      rejectMutation.mutate({ id: currentId, reason: rejectReason.trim() })
    }
  }

  // 查看设备详情
  const viewDeviceDetail = async (record: any) => {
    try {
      const hardwareData = JSON.parse(record.hardwareData)
      setCurrentRecord(record)

      // 从 hardwareData 提取字段，处理可能的编码问题
      const assetCode = hardwareData.assetCode?.trim() || '待生成'
      const userName = hardwareData.userName?.trim() || '-'
      const location = hardwareData.location?.trim() || '-'
      const submitterIp = record.submitterIp || hardwareData.submitterIp || '-'

      if (record.deviceId && record.device) {
        // 有关联设备
        setSelectedDevice({
          name: record.device.name,
          deviceCode: assetCode,
          userName: userName,
          status: '待审批',
          location: location,
          submitterIp: submitterIp,
          hardware: hardwareData,
        })
      } else if (record.deviceId) {
        // 有设备 ID 但没有设备数据
        const resp = await deviceApi.getDetail(record.deviceId)
        const deviceData = resp.data
        setSelectedDevice({
          name: deviceData.name,
          deviceCode: assetCode,
          userName: userName,
          status: deviceData.status,
          location: location,
          submitterIp: submitterIp,
          hardware: hardwareData,
        })
      } else {
        // 新设备，从 hardwareData 获取信息
        setSelectedDevice({
          name: hardwareData.hostname?.trim() || record.deviceName || '新设备',
          deviceCode: assetCode,
          userName: userName,
          status: '待审批',
          location: location,
          submitterIp: submitterIp,
          hardware: hardwareData,
        })
      }
      setDetailVisible(true)
    } catch (error) {
      console.error('获取设备详情失败:', error)
      message.error('获取设备详情失败')
    }
  }

  // 待审批列表列
  const pendingColumns = [
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      width: 160,
    },
    {
      title: '设备名称',
      key: 'deviceName',
      render: (_: unknown, record: any) => (
        <Text strong>{record.deviceName || record.device?.name || '新设备'}</Text>
      ),
    },
    {
      title: '采集 IP',
      dataIndex: 'submitterIp',
      key: 'submitterIp',
      render: (ip: string) => <Text code>{ip || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: unknown, record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewDeviceDetail(record)}
          >
            查看详情
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record.id)}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleReject(record.id)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ]

  // 已审批列表列
  const approvedColumns = [
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      width: 160,
    },
    {
      title: '设备名称',
      key: 'deviceName',
      render: (_: unknown, record: any) => (
        <Text strong>{record.deviceName || record.device?.name || '新设备'}</Text>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: any) => {
        const isApproved = record.status === 'APPROVED'
        return (
          <Tag color={isApproved ? 'green' : 'red'} icon={isApproved ? <CheckCircleOutlined /> : <CloseOutlined />}>
            {isApproved ? '已通过' : '已拒绝'}
          </Tag>
        )
      },
    },
    {
      title: '审批人',
      key: 'approver',
      render: (_: unknown, record: any) => record.approver?.username || '-',
    },
    {
      title: '审批时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '拒绝原因',
      key: 'rejectedReason',
      render: (_: unknown, record: any) =>
        record.status === 'REJECTED' ? (
          <Text type="danger">{record.rejectedReason || '-'}</Text>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewDeviceDetail(record)}
        >
          查看设备
        </Button>
      ),
    },
  ]

  const tabsItems = [
    {
      key: 'pending',
      label: (
        <Space>
          <ClockCircleOutlined />
          待审批
          <Tag color="orange">{pendingApprovals.length}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={pendingColumns}
          dataSource={pendingApprovals}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="暂无待审批记录" /> }}
        />
      ),
    },
    {
      key: 'approved',
      label: (
        <Space>
          <CheckCircleOutlined />
          已审批
          <Tag color="green">{approvedApprovals.length}</Tag>
        </Space>
      ),
      children: (
        <Tabs
          type="card"
          items={[
            {
              key: 'all',
              label: `全部 (${allApprovals.length})`,
              children: (
                <Table
                  columns={approvedColumns}
                  dataSource={allApprovals}
                  loading={isLoading}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无已审批记录" /> }}
                />
              ),
            },
            {
              key: 'passed',
              label: `已通过 (${approvedApprovals.length})`,
              children: (
                <Table
                  columns={approvedColumns}
                  dataSource={approvedApprovals}
                  loading={isLoading}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无已通过记录" /> }}
                />
              ),
            },
            {
              key: 'rejected',
              label: `已拒绝 (${rejectedApprovals.length})`,
              children: (
                <Table
                  columns={approvedColumns}
                  dataSource={rejectedApprovals}
                  loading={isLoading}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无已拒绝记录" /> }}
                />
              ),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <Tabs items={tabsItems} activeKey={activeTab} onChange={setActiveTab} />

      {/* 拒绝原因 Modal */}
      <Modal
        title="拒绝原因"
        open={rejectModalVisible}
        onOk={confirmReject}
        onCancel={() => {
          setRejectModalVisible(false)
          setCurrentId(null)
          setRejectReason('')
        }}
        confirmLoading={rejectMutation.isPending}
        okButtonProps={{ disabled: !rejectReason.trim() }}
      >
        <Input.TextArea
          rows={4}
          placeholder="请输入拒绝原因（必填）"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* 设备详情 Drawer */}
      <Drawer
        title="设备详情"
        placement="right"
        width={700}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false)
          setSelectedDevice(null)
        }}
      >
        {selectedDevice && (
          <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="设备名称">{selectedDevice.name}</Descriptions.Item>
              <Descriptions.Item label="资产编号">{selectedDevice.deviceCode || '待生成'}</Descriptions.Item>
              <Descriptions.Item label="使用人">{selectedDevice.userName || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {selectedDevice.status ? (
                  <Tag color={statusMap[selectedDevice.status]?.color}>
                    {statusMap[selectedDevice.status]?.text}
                  </Tag>
                ) : (
                  <Tag color="orange">待审批</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="放置位置">{selectedDevice.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="采集 IP">
                <Text code>{selectedDevice.submitterIp || '-'}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {selectedDevice?.hardware && (
          <Card title="硬件信息" size="small">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="CPU">{selectedDevice.hardware.cpu || '-'}</Descriptions.Item>
              <Descriptions.Item label="内存">{selectedDevice.hardware.memory || '-'}</Descriptions.Item>
              <Descriptions.Item label="硬盘">{formatHardwareField(selectedDevice.hardware.disk)}</Descriptions.Item>
              <Descriptions.Item label="显卡">{formatHardwareField(selectedDevice.hardware.gpu)}</Descriptions.Item>
              <Descriptions.Item label="主板">{selectedDevice.hardware.motherboard || '-'}</Descriptions.Item>
              <Descriptions.Item label="操作系统">{selectedDevice.hardware.os || '-'}</Descriptions.Item>
              <Descriptions.Item label="MAC 地址">{selectedDevice.hardware.macAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label="采集 IP">
                {selectedDevice.submitterIp || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="采集时间">
                {selectedDevice.hardware.collectedAt
                  ? new Date(selectedDevice.hardware.collectedAt).toLocaleString()
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {currentRecord?.status === 'PENDING' && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Space size="large">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                size="large"
                onClick={() => handleApprove(currentRecord.id)}
              >
                审核通过
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                size="large"
                onClick={() => handleReject(currentRecord.id)}
              >
                拒绝
              </Button>
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default ApprovalList
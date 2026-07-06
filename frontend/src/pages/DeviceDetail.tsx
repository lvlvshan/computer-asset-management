// 设备详情页面 - 添加快速审批功能
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Descriptions,
  Card,
  Tag,
  Space,
  Button,
  Timeline,
  Tabs,
  Empty,
  Alert,
  Modal,
  Input,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import { deviceApi, approvalApi } from '../api'

const statusMap: Record<string, { text: string; color: string }> = {
  IN_USE: { text: '使用中', color: 'green' },
  IDLE: { text: '闲置', color: 'blue' },
  REPAIR: { text: '维修中', color: 'orange' },
  SCRAPPED: { text: '已报废', color: 'red' },
}

const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => deviceApi.getDetail(id!).then((r) => r.data),
    enabled: !!id,
  })

  // 审批通过 mutation
  const approveMutation = useMutation({
    mutationFn: (approvalId: string) => approvalApi.approve(approvalId),
    onSuccess: () => {
      message.success('审批通过')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setRejectModalVisible(false)
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '审批失败')
    },
  })

  // 审批拒绝 mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalApi.reject(id, { reason }),
    onSuccess: () => {
      message.success('已拒绝')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setRejectModalVisible(false)
      setRejectReason('')
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '操作失败')
    },
  })

  // 归还设备
  const returnMutation = useMutation({
    mutationFn: () => deviceApi.returnDevice(id!),
    onSuccess: () => {
      message.success('已归还')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '归还失败')
    },
  })

  const handleApprove = (approvalId: string) => {
    approveMutation.mutate(approvalId)
  }

  const handleReject = () => {
    if (device?.pendingApprovals?.[0]?._id || device?.pendingApprovals?.[0]?.id) {
      const approvalId = device.pendingApprovals[0]._id || device.pendingApprovals[0].id
      rejectMutation.mutate({ id: approvalId, reason: rejectReason.trim() })
    }
  }

  if (isLoading || !device) {
    return <div>加载中...</div>
  }

  const statusInfo = statusMap[device.status] || { text: device.status, color: 'default' }

  // 待审批数据
  const pendingApproval = device.pendingApprovals?.[0]

  // 使用人历史
  const userHistoryItems = device.historicalUsers?.map((record: any, idx: number) => ({
    color: 'blue',
    children: (
      <div>
        <p style={{ margin: 0 }}>
          <strong>{record.user?.username || record.userName}</strong>
          <span style={{ marginLeft: 8, color: '#999' }}>
            {record.changeReason}
          </span>
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
          {new Date(record.startDate).toLocaleDateString('zh-CN')} ~ {record.endDate ? new Date(record.endDate).toLocaleDateString('zh-CN') : '至今'}
          {record.location && <span style={{ marginLeft: 12 }}>📍 {record.location}</span>}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
          操作人：{record.changedBy}
        </p>
      </div>
    ),
  }))

  // 维修历史
  const maintenanceItems = device.maintenanceRecords?.map((record: any) => ({
    color: record.endDate ? 'green' : 'orange',
    children: (
      <div>
        <p style={{ margin: 0 }}>
          <Tag color={record.maintenanceType === 'HARDWARE' ? 'red' : 'blue'}>
            {record.maintenanceType === 'HARDWARE' ? '硬件' : record.maintenanceType === 'SOFTWARE' ? '软件' : '其他'}
          </Tag>
          <span style={{ marginLeft: 8 }}>{record.description}</span>
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
          送修日期：{new Date(record.startDate).toLocaleDateString()}
          {record.endDate ? ` | 修复日期：${new Date(record.endDate).toLocaleDateString()}` : ' (维修中)'}
        </p>
        {record.solution && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
            处理方案：{record.solution}
          </p>
        )}
        {record.cost && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
            费用：¥{record.cost}
          </p>
        )}
      </div>
    ),
  }))

  const items = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Card title="基本信息">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="资产编号">{device.deviceCode}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前使用人">
              {device.currentUserName || device.currentUser?.username || '无'}
              {device.currentUserName || device.currentUser?.username ? (
                <Button type="link" size="small" icon={<RollbackOutlined />} danger style={{ marginLeft: 12 }} onClick={() => {
                  Modal.confirm({ title: '确认归还', content: `确定将设备从 ${device.currentUserName || device.currentUser?.username} 处归还？`, onOk: () => returnMutation.mutate() })
                }}>归还</Button>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="所属部门">{device.organization || '-'}</Descriptions.Item>
            <Descriptions.Item label="放置位置">{device.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="采购日期">
              {device.purchaseDate ? new Date(device.purchaseDate).toLocaleDateString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="保修截止">
              {device.warrantyEnd ? new Date(device.warrantyEnd).toLocaleDateString() : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'hardware',
      label: '硬件信息',
      children: (
        <Card title="硬件配置">
          {device.hardware ? (
            <Descriptions column={2} bordered>
              <Descriptions.Item label="CPU">{device.hardware.cpu || '-'}</Descriptions.Item>
              <Descriptions.Item label="内存">{device.hardware.memory || '-'}</Descriptions.Item>
              <Descriptions.Item label="硬盘">{device.hardware.disk || '-'}</Descriptions.Item>
              <Descriptions.Item label="显卡">{device.hardware.gpu || '-'}</Descriptions.Item>
              <Descriptions.Item label="主板">{device.hardware.motherboard || '-'}</Descriptions.Item>
              <Descriptions.Item label="操作系统">{device.hardware.os || '-'}</Descriptions.Item>
              <Descriptions.Item label="采集 IP">
                {device.hardware.submitterIp || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="采集时间">
                {device.hardware.collectedAt ? new Date(device.hardware.collectedAt).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description="暂无硬件信息" />
          )}
        </Card>
      ),
    },
    {
      key: 'hw-versions',
      label: '硬件版本对比',
      children: (
        <Card title="各审批版本的硬件配置">
          {device.hardwareVersions?.length > 0 ? (
            <Timeline
              items={device.hardwareVersions.map((v: any, idx: number) => ({
                color: idx === 0 ? 'green' : 'blue',
                children: (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color={idx === 0 ? 'green' : 'default'}>v{device.hardwareVersions.length - idx}</Tag>
                      <strong>{v.deviceName}</strong>
                      <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
                        审批时间：{new Date(v.createdAt).toLocaleString()}
                      </span>
                      <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
                        资产编号：{v.deviceCode}
                      </span>
                    </div>
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="CPU">{v.cpu || '-'}</Descriptions.Item>
                      <Descriptions.Item label="内存">{v.memory || '-'}</Descriptions.Item>
                      <Descriptions.Item label="硬盘">{v.disk || '-'}</Descriptions.Item>
                      <Descriptions.Item label="显卡">{v.gpu || '-'}</Descriptions.Item>
                      <Descriptions.Item label="操作系统">{v.os || '-'}</Descriptions.Item>
                      <Descriptions.Item label="MAC 地址">{v.macAddress || '-'}</Descriptions.Item>
                    </Descriptions>
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="暂无版本对比数据" />
          )}
        </Card>
      ),
    },
    {
      key: 'history',
      label: '使用人历史',
      children: (
        <Card>
          {userHistoryItems?.length > 0 ? (
            <Timeline items={userHistoryItems} />
          ) : (
            <Empty description="暂无使用人变更记录" />
          )}
        </Card>
      ),
    },
    {
      key: 'maintenance',
      label: '维修历史',
      children: (
        <Card>
          {maintenanceItems?.length > 0 ? (
            <Timeline items={maintenanceItems} />
          ) : (
            <Empty description="暂无维修记录" />
          )}
        </Card>
      ),
    },
    {
      key: 'pending-maint',
      label: '待审批维修',
      children: (
        <Card>
          {device.pendingMaintenances?.filter((pm: any) => pm.status === 'PENDING').length > 0 ? (
            <Timeline
              items={device.pendingMaintenances
                .filter((pm: any) => pm.status === 'PENDING')
                .map((pm: any) => ({
                  color: 'orange',
                  children: (
                    <div>
                      <p style={{ margin: 0 }}>
                        <Tag color={pm.maintenanceType === 'HARDWARE' ? 'red' : 'blue'}>
                          {pm.maintenanceType === 'HARDWARE' ? '硬件' : pm.maintenanceType === 'SOFTWARE' ? '软件' : '其他'}
                        </Tag>
                        <span style={{ marginLeft: 8 }}>{pm.description}</span>
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
                        提交人：{pm.submitter?.username || '-'} | {new Date(pm.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ),
                }))}
            />
          ) : (
            <Empty description="暂无待审批维修记录" />
          )}
        </Card>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/devices')}>
          返回列表
        </Button>
      </Space>

      {/* 待审批提醒 */}
      {pendingApproval && pendingApproval.status === 'PENDING' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="此设备有待审批的采集数据"
          description={
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={() => {
                  const aid = pendingApproval._id || pendingApproval.id
                  handleApprove(aid)
                }}
              >
                一键通过
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                size="small"
                onClick={() => setRejectModalVisible(true)}
              >
                拒绝
              </Button>
              <Tag color="gray" style={{ marginLeft: 8 }}>
                提交时间：{new Date(pendingApproval.createdAt).toLocaleString()}
              </Tag>
            </Space>
          }
        />
      )}

      <Tabs items={items} defaultActiveKey="basic" />

      {/* 拒绝原因 Modal */}
      <Modal
        title="拒绝原因"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalVisible(false)
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

    </div>
  )
}

export default DeviceDetail
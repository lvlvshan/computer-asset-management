// 设备列表页面
import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  message,
  Form,
  DatePicker,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { deviceApi, userApi, Device } from '../api'
import { exportToExcel } from '../utils/export'
import dayjs from 'dayjs'

const statusMap: Record<string, { text: string; color: string }> = {
  IN_USE: { text: '使用中', color: 'green' },
  IDLE: { text: '闲置', color: 'blue' },
  REPAIR: { text: '维修中', color: 'orange' },
  SCRAPPED: { text: '已报废', color: 'red' },
}

const DeviceList: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>()
  const [orgFilter, setOrgFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [userFilter, setUserFilter] = useState<string>()
  const [macFilter, setMacFilter] = useState('')
  const [hardwareFilter, setHardwareFilter] = useState('')
  const [approvalDateRange, setApprovalDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 批量操作
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchForm] = Form.useForm()
  const [batchLoading, setBatchLoading] = useState(false)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', { status: statusFilter, search, organization: orgFilter, location: locationFilter, currentUserId: userFilter, macAddress: macFilter, hardware: hardwareFilter, fromApprovalDate: approvalDateRange?.[0]?.toISOString(), toApprovalDate: approvalDateRange?.[1]?.toISOString() }],
    queryFn: () => deviceApi.getList({
      status: statusFilter,
      search,
      organization: orgFilter || undefined,
      location: locationFilter || undefined,
      currentUserId: userFilter,
      macAddress: macFilter || undefined,
      hardware: hardwareFilter || undefined,
      fromApprovalDate: approvalDateRange?.[0]?.toISOString(),
      toApprovalDate: approvalDateRange?.[1]?.toISOString(),
    }).then((r) => r.data),
  })

  // 获取用户列表用于使用人筛选
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getList().then((r) => r.data),
    retry: false,
  })

  const userRole = localStorage.getItem('userRole')
  const isAdmin = userRole === 'ADMIN'

  // MAC 分组逻辑
  const groupedDevices = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const d of devices) {
      const mac = d.hardware?.macAddress
      if (!mac) {
        // 无 MAC 设备保持独立行
        groups['__no_mac_' + d.id] = [d]
      } else {
        if (!groups[mac]) groups[mac] = []
        groups[mac].push(d)
      }
    }
    const result: any[] = []
    for (const [mac, list] of Object.entries(groups)) {
      if (mac.startsWith('__no_mac_') || list.length === 1) {
        result.push(list[0])
      } else {
        // 同 MAC 多设备：按 createdAt 排序，最新为主行
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        const primary = { ...list[0], _children: list.slice(1) }
        result.push(primary)
      }
    }
    return result
  }, [devices])

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个设备吗？',
      onOk: async () => {
        try {
          await deviceApi.delete(id)
          message.success('删除成功')
          queryClient.invalidateQueries({ queryKey: ['devices'] })
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleExportExcel = () => {
    if (userRole !== 'ADMIN' && userRole !== 'MAINTENANCE') {
      message.warning('没有导出权限')
      return
    }
    const exportData = devices.map((d: any) => ({
      '资产编号': d.deviceCode,
      '设备名称': d.name,
      '状态': statusMap[d.status]?.text || d.status,
      '使用人': d.currentUserName || d.currentUser?.username || '',
      '部门': d.organization || '',
      '位置': d.location || '',
      'MAC地址': d.hardware?.macAddress || '',
    }))
    exportToExcel(exportData, `设备列表_${new Date().toISOString().slice(0, 10)}`)
    message.success('导出成功')
  }

  const handleBatchUpdate = async () => {
    try {
      const values = await batchForm.validateFields()
      const updates: any = {}
      if (values.organization) updates.organization = values.organization
      if (values.location) updates.location = values.location
      if (values.status) updates.status = values.status

      if (Object.keys(updates).length === 0) {
        message.warning('请至少填写一个要修改的字段')
        return
      }

      setBatchLoading(true)
      const res = await deviceApi.batchUpdate({ ids: selectedRowKeys, updates })
      message.success(res.data.message || '批量更新成功')
      setBatchModalOpen(false)
      setSelectedRowKeys([])
      batchForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    } catch (err: any) {
      if (err.response) {
        message.error(err.response.data?.error || '批量更新失败')
      }
    } finally {
      setBatchLoading(false)
    }
  }

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'deviceCode',
      key: 'deviceCode',
      sorter: (a: any, b: any) => a.deviceCode.localeCompare(b.deviceCode),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: any, b: any) => a.status.localeCompare(b.status),
      render: (status: string) => {
        const { text, color } = statusMap[status] || { text: status, color: 'default' }
        return <Tag color={color}>{text}</Tag>
      },
    },
    {
      title: '使用人',
      key: 'currentUser',
      sorter: (a: any, b: any) => {
        const ua = a.currentUser?.username || ''
        const ub = b.currentUser?.username || ''
        return ua.localeCompare(ub)
      },
      render: (_: unknown, record: any) => {
        const uname = record.currentUserName || record.currentUser?.username
        return uname || '-'
      }
    },
    {
      title: '部门',
      dataIndex: 'organization',
      key: 'organization',
      sorter: (a: any, b: any) => (a.organization || '').localeCompare(b.organization || ''),
      render: (org?: string) => org || '-'
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      sorter: (a: any, b: any) => (a.location || '').localeCompare(b.location || ''),
      render: (loc?: string) => loc || '-'
    },
    {
      title: 'MAC 地址',
      key: 'macAddress',
      sorter: (a: any, b: any) => (a.hardware?.macAddress || '').localeCompare(b.hardware?.macAddress || ''),
      render: (_: unknown, record: any) => record.hardware?.macAddress || '-'
    },
    {
      title: 'CPU',
      key: 'cpu',
      sorter: (a: any, b: any) => (a.hardware?.cpu || '').localeCompare(b.hardware?.cpu || ''),
      render: (_: unknown, record: any) => record.hardware?.cpu || '-'
    },
    {
      title: '内存',
      key: 'memory',
      sorter: (a: any, b: any) => (a.hardware?.memory || '').localeCompare(b.hardware?.memory || ''),
      render: (_: unknown, record: any) => record.hardware?.memory || '-'
    },
    {
      title: '磁盘',
      key: 'disk',
      sorter: (a: any, b: any) => (a.hardware?.disk || '').localeCompare(b.hardware?.disk || ''),
      render: (_: unknown, record: any) => record.hardware?.disk || '-'
    },
    {
      title: '显卡',
      key: 'gpu',
      sorter: (a: any, b: any) => (a.hardware?.gpu || '').localeCompare(b.hardware?.gpu || ''),
      render: (_: unknown, record: any) => record.hardware?.gpu || '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Device) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/devices/${record.id}`)}
          >
            查看
          </Button>
          {isAdmin && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/devices/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {isAdmin && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter(undefined)
    setOrgFilter('')
    setLocationFilter('')
    setUserFilter(undefined)
    setMacFilter('')
    setHardwareFilter('')
    setApprovalDateRange(null)
  }

  const hasAdvancedFilters = orgFilter || locationFilter || userFilter || macFilter || hardwareFilter || approvalDateRange

  return (
    <div>
      {/* 搜索区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Space wrap>
            <Input
              placeholder="搜索设备名称或编号"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 110 }}
              allowClear
            >
              <Select.Option value="IN_USE">使用中</Select.Option>
              <Select.Option value="IDLE">闲置</Select.Option>
              <Select.Option value="REPAIR">维修中</Select.Option>
              <Select.Option value="SCRAPPED">已报废</Select.Option>
            </Select>
            <Button
              type="link"
              size="small"
              icon={showAdvanced ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '收起高级筛选' : `高级筛选${hasAdvancedFilters ? ' (已启用)' : ''}`}
            </Button>
            {hasAdvancedFilters && (
              <Button type="link" size="small" onClick={clearAllFilters}>
                清除筛选
              </Button>
            )}
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
              导出 Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/devices/new')}
            >
              新增设备
            </Button>
          </Space>
        </div>

        {/* 高级筛选面板 */}
        {showAdvanced && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fafafa',
              borderRadius: 4,
              border: '1px solid #f0f0f0',
              marginTop: 8,
            }}
          >
            <Space wrap size="middle">
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>使用人</div>
                <Select
                  placeholder="选择使用人"
                  value={userFilter}
                  onChange={setUserFilter}
                  style={{ width: 160 }}
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={users.map((u: any) => ({ label: u.username, value: u.id }))}
                  notFoundContent="暂无用户"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>部门</div>
                <Input
                  placeholder="输入部门关键字"
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  style={{ width: 160 }}
                  allowClear
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>位置</div>
                <Input
                  placeholder="输入位置关键字"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  style={{ width: 160 }}
                  allowClear
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>MAC 地址</div>
                <Input
                  placeholder="输入 MAC 地址"
                  value={macFilter}
                  onChange={(e) => setMacFilter(e.target.value)}
                  style={{ width: 180 }}
                  allowClear
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>硬件信息</div>
                <Input
                  placeholder="搜索 CPU/内存/磁盘/GPU"
                  value={hardwareFilter}
                  onChange={(e) => setHardwareFilter(e.target.value)}
                  style={{ width: 220 }}
                  allowClear
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>审批时间</div>
                <DatePicker.RangePicker
                  value={approvalDateRange}
                  onChange={(dates) => setApprovalDateRange(dates)}
                  style={{ width: 240 }}
                />
              </div>
            </Space>
          </div>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 4,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            已选择 <strong>{selectedRowKeys.length}</strong> 台设备
          </span>
          <Space>
            {isAdmin && (
              <Button
                size="small"
                onClick={() => {
                  batchForm.resetFields()
                  setBatchModalOpen(true)
                }}
              >
                批量修改
              </Button>
            )}
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              取消选择
            </Button>
          </Space>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={groupedDevices}
        loading={isLoading}
        rowKey="id"
        expandable={{
          expandedRowRender: (record: any) => {
            const children = record._children
            if (!children?.length) return null
            // 子行只有"查看"按钮
            const subColumns = columns.map(col => {
              if (col.key === 'action') {
                return {
                  ...col,
                  render: (_: unknown, subRecord: Device) => (
                    <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/devices/${subRecord.id}`)}>查看</Button>
                  ),
                }
              }
              return col
            })
            return (
              <Table
                columns={subColumns}
                dataSource={children}
                rowKey="id"
                pagination={false}
                showHeader={false}
                style={{ margin: 0 }}
              />
            )
          },
          rowExpandable: (record: any) => !!record._children?.length,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: any[]) => setSelectedRowKeys(keys),
        }}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          defaultPageSize: 20,
        }}
      />

      {/* 批量修改弹窗 */}
      <Modal
        title="批量修改设备信息"
        open={batchModalOpen}
        onCancel={() => { setBatchModalOpen(false); batchForm.resetFields() }}
        onOk={handleBatchUpdate}
        confirmLoading={batchLoading}
        okText="确认修改"
      >
        <div style={{ marginBottom: 12, color: '#999', fontSize: 13 }}>
          将修改 <strong>{selectedRowKeys.length}</strong> 台设备的以下字段（留空表示不修改）
        </div>
        <Form
          form={batchForm}
          layout="vertical"
          style={{ maxWidth: 400 }}
        >
          <Form.Item name="organization" label="部门">
            <Input placeholder="填写新部门（留空不修改）" allowClear />
          </Form.Item>
          <Form.Item name="location" label="位置">
            <Input placeholder="填写新位置（留空不修改）" allowClear />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="选择新状态（留空不修改）" allowClear>
              <Select.Option value="IN_USE">使用中</Select.Option>
              <Select.Option value="IDLE">闲置</Select.Option>
              <Select.Option value="REPAIR">维修中</Select.Option>
              <Select.Option value="SCRAPPED">已报废</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DeviceList

// 维修人员 - 提交维修记录
import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Form, Input, InputNumber, Select, Button, Card, message, DatePicker, Space, Descriptions, Tag } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { deviceApi, maintenanceApi } from '../api'

const statusMap: Record<string, { text: string; color: string }> = {
  IN_USE: { text: '使用中', color: 'green' },
  IDLE: { text: '闲置', color: 'blue' },
  REPAIR: { text: '维修中', color: 'orange' },
  SCRAPPED: { text: '已报废', color: 'red' },
}

const MaintenanceForm: React.FC = () => {
  const { id: deviceId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const { data: device, isLoading: deviceLoading } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => deviceApi.getDetail(deviceId!).then((r) => r.data),
    enabled: !!deviceId,
  })

  const submitMutation = useMutation({
    mutationFn: (data: any) => maintenanceApi.submitMaintenance(data),
    onSuccess: () => {
      message.success('维修记录已提交，等待管理员审批')
      navigate('/maintenance/my-submissions')
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || '提交失败')
    },
  })

  const onFinish = (values: any) => {
    submitMutation.mutate({
      deviceId,
      maintenanceType: values.maintenanceType,
      description: values.description,
      solution: values.solution || '',
      cost: values.cost || null,
      vendor: values.vendor || '',
      startDate: values.startDate.format('YYYY-MM-DD'),
      endDate: values.endDate?.format('YYYY-MM-DD') || null,
      currentUserName: values.currentUserName || '',
    })
  }

  if (deviceLoading) {
    return <div>加载中...</div>
  }

  if (!device) {
    return <div>设备不存在</div>
  }

  const statusInfo = statusMap[device.status] || { text: device.status, color: 'default' }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/maintenance/devices')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title="设备信息" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="资产编号">{device.deviceCode}</Descriptions.Item>
          <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前使用人">
            {device.currentUserName || device.currentUser?.username || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="部门">{device.organization || '-'}</Descriptions.Item>
          <Descriptions.Item label="位置">{device.location || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="维修信息">
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
          <Form.Item
            name="maintenanceType"
            label="维修类型"
            rules={[{ required: true, message: '请选择维修类型' }]}
          >
            <Select placeholder="选择维修类型">
              <Select.Option value="HARDWARE">硬件维修</Select.Option>
              <Select.Option value="SOFTWARE">软件维护</Select.Option>
              <Select.Option value="OTHER">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="故障描述"
            rules={[{ required: true, message: '请输入故障描述' }]}
          >
            <Input.TextArea rows={4} placeholder="详细描述故障现象" />
          </Form.Item>

          <Form.Item name="solution" label="处理方案">
            <Input.TextArea rows={3} placeholder="初步处理方案（可选）" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="startDate"
              label="送修日期"
              rules={[{ required: true, message: '请选择送修日期' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="选择送修日期" />
            </Form.Item>

            <Form.Item name="endDate" label="修复日期（可选）">
              <DatePicker style={{ width: '100%' }} placeholder="选择修复日期" />
            </Form.Item>
          </Space>

          <Form.Item name="vendor" label="维修商">
            <Input placeholder="例如：XX 电脑维修中心（可选）" />
          </Form.Item>

          <Form.Item name="cost" label="维修费用（元）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="可选" />
          </Form.Item>

          <Form.Item
            name="currentUserName"
            label="当前使用人（自由填写）"
            help="如设备使用人有变更，请在此填写新的使用人姓名"
          >
            <Input placeholder="输入使用人姓名（可选，如变更请填写）" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitMutation.isPending}>
                提交维修记录
              </Button>
              <Button onClick={() => navigate('/maintenance/devices')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default MaintenanceForm

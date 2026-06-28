// 设备表单页面（新建/编辑）
import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Select, Button, Card, message, DatePicker, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { deviceApi } from '../api'

const DeviceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  const isEdit = !!id

  // 加载设备数据（编辑模式）
  const { data: device, isLoading: deviceLoading, error: deviceError } = useQuery({
    queryKey: ['device', id],
    queryFn: () => deviceApi.getDetail(id!).then((r) => r.data),
    enabled: isEdit,
  })

  // 填充表单数据
  useEffect(() => {
    if (isEdit && device) {
      try {
        form.setFieldsValue({
          deviceCode: device.deviceCode,
          name: device.name,
          status: device.status,
          currentUserId: device.currentUserId || undefined,
          currentUserName: device.currentUserName || device.currentUser?.username || undefined,
          organization: device.organization,
          location: device.location,
          purchaseDate: device.purchaseDate ? dayjs(device.purchaseDate) : null,
          warrantyEnd: device.warrantyEnd ? dayjs(device.warrantyEnd) : null,
        })
      } catch (e) {
        console.error('设置表单值失败:', e)
      }
    }
  }, [device, form, isEdit])

  // 保存 mutation（必须在早期 return 之前定义）
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? deviceApi.update(id!, data)
        : deviceApi.create(data),
    onSuccess: () => {
      message.success(isEdit ? '更新成功' : '创建成功')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      navigate('/devices')
    },
    onError: () => {
      message.error(isEdit ? '更新失败' : '创建失败')
    },
  })

  // 加载状态
  if (isEdit && deviceLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <div>加载中...</div>
      </div>
    )
  }

  // 错误状态
  if (deviceError) {
    return (
      <div>
        <Button
          style={{ marginBottom: 16 }}
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/devices')}
        >
          返回列表
        </Button>
        <div style={{ color: 'red' }}>加载设备信息失败，请重试</div>
      </div>
    )
  }

  const onFinish = (values: any) => {
    const data = {
      ...values,
      deviceCode: values.deviceCode,
      name: values.name,
      status: values.status,
      currentUserName: values.currentUserName || null,
      organization: values.organization,
      location: values.location,
      purchaseDate: values.purchaseDate?.format('YYYY-MM-DD'),
      warrantyEnd: values.warrantyEnd?.format('YYYY-MM-DD'),
    }
    saveMutation.mutate(data)
  }

  return (
    <div>
      <Button
        style={{ marginBottom: 16 }}
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/devices')}
      >
        返回列表
      </Button>

      <Card title={isEdit ? '编辑设备' : '新增设备'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 600 }}
          initialValues={{ status: 'IDLE' }}
        >
          <Form.Item
            name="deviceCode"
            label="资产编号"
            rules={[{ required: !isEdit, message: '请输入资产编号' }]}
          >
            <Input placeholder="例如：DEV20240101" disabled={isEdit} />
          </Form.Item>

          <Form.Item
            name="name"
            label="设备名称"
            rules={[{ required: true, message: '请输入设备名称' }]}
          >
            <Input placeholder="例如：研发部 - 张三的笔记本电脑" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="IN_USE">使用中</Select.Option>
              <Select.Option value="IDLE">闲置</Select.Option>
              <Select.Option value="REPAIR">维修中</Select.Option>
              <Select.Option value="SCRAPPED">已报废</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="currentUserName" label="当前使用人">
            <Input placeholder="输入使用人姓名" allowClear />
          </Form.Item>

          <Form.Item name="organization" label="所属部门">
            <Input placeholder="例如：研发部" />
          </Form.Item>

          <Form.Item name="location" label="放置位置">
            <Input placeholder="例如：3 号楼 501 室" />
          </Form.Item>

          <Form.Item name="purchaseDate" label="采购日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择采购日期" />
          </Form.Item>

          <Form.Item name="warrantyEnd" label="保修截止">
            <DatePicker style={{ width: '100%' }} placeholder="选择保修截止日期" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => navigate('/devices')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default DeviceForm
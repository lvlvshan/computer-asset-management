// 测试中文拒绝原因
const fetch = require('node-fetch')

const API_URL = 'http://localhost:3000'

async function test() {
  // 登录
  const loginResp = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  })
  const { token } = await loginResp.json()
  console.log('Token:', token.substring(0, 50) + '...')

  // 创建测试数据
  const uploadResp = await fetch(`${API_URL}/api/scan/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostname: 'Test-CN',
      cpu: 'Intel',
      memory: '16GB',
      macAddress: 'AA:BB:CC:DD:EE:11'
    })
  })
  const { approvalId } = await uploadResp.json()
  console.log('Approval ID:', approvalId)

  // 拒绝（中文原因）
  const rejectResp = await fetch(`${API_URL}/api/approvals/${approvalId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reason: '设备信息不符，请重新提交' })
  })
  const rejectResult = await rejectResp.json()
  console.log('拒绝结果:', rejectResult)

  // 查看结果
  const detailResp = await fetch(`${API_URL}/api/approvals/${approvalId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const detail = await detailResp.json()
  console.log('审批详情:')
  console.log('  - 状态:', detail.status)
  console.log('  - 拒绝原因:', detail.rejectedReason)
}

test().catch(console.error)
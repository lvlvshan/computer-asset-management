// 测试中文拒绝原因
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  // 先创建一个测试审批记录
  const approval = await prisma.pendingApproval.create({
    data: {
      deviceName: 'Test-CN',
      hardwareData: JSON.stringify({ hostname: 'Test', cpu: 'Intel' }),
      submitterIp: '127.0.0.1',
      sessionToken: 'test-chinese',
      status: 'PENDING',
    },
  })

  console.log('创建审批记录:', approval.id)

  // 更新为拒绝状态，带中文原因
  const updated = await prisma.pendingApproval.update({
    where: { id: approval.id },
    data: {
      status: 'REJECTED',
      rejectedReason: '设备信息不符，请重新提交',
    },
  })

  console.log('更新后的拒绝原因:', updated.rejectedReason)
  console.log('状态:', updated.status)

  // 直接查询验证
  const check = await prisma.pendingApproval.findUnique({
    where: { id: approval.id },
  })
  console.log('直接查询拒绝原因:', check?.rejectedReason)

  await prisma.disconnect()
}

test().catch(console.error)
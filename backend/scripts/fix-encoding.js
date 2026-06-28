// 修复数据库中文编码问题
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixEncoding() {
  // 列出所有设备
  const devices = await prisma.device.findMany()
  console.log('当前设备列表:', devices)

  // 更新测试设备名称
  await prisma.device.updateMany({
    where: { deviceCode: 'TEST001' },
    data: {
      name: '测试电脑',
      organization: '技术部',
      location: '3 楼 301'
    }
  })

  // 列出更新后的设备
  const updatedDevices = await prisma.device.findMany()
  console.log('更新后设备列表:', updatedDevices)

  await prisma.$disconnect()
}

fixEncoding().catch(console.error)
// 数据库种子脚本 - 创建默认账户
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 创建默认管理员账户（如果没有）
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: { username: 'admin', password: hashedPassword, role: 'ADMIN' },
    })
    console.log('  - 管理员：admin / admin123')
  }

  // 创建测试普通用户（如果没有）
  const existingStaff = await prisma.user.findUnique({ where: { username: 'staff' } })
  if (!existingStaff) {
    const hashedStaffPassword = await bcrypt.hash('staff123', 10)
    await prisma.user.create({
      data: { username: 'staff', password: hashedStaffPassword, role: 'STAFF' },
    })
    console.log('  - 普通用户：staff / staff123')
  }

  // 创建测试维修人员（如果没有）
  const existingMaint = await prisma.user.findUnique({ where: { username: 'maintenance' } })
  if (!existingMaint) {
    const hashedMaintPassword = await bcrypt.hash('maint123', 10)
    await prisma.user.create({
      data: { username: 'maintenance', password: hashedMaintPassword, role: 'MAINTENANCE' },
    })
    console.log('  - 维修人员：maintenance / maint123')
  }

  console.log('种子数据检查完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

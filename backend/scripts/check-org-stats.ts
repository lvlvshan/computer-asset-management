import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 总设备数
  const total = await prisma.device.count()
  console.log('=== 总设备数:', total)

  // 按部门统计
  const byOrg = await prisma.device.groupBy({
    by: ['organization'],
    _count: { id: true },
  })
  console.log('\n=== 按部门统计:')
  let orgSum = 0
  for (const row of byOrg.sort((a, b) => (a.organization || '').localeCompare(b.organization || ''))) {
    console.log('  ' + (row.organization || '(NULL)') + ': ' + row._count.id)
    orgSum += row._count.id
  }
  console.log('  部门合计:', orgSum)

  // 查看 organization 为 NULL 的设备
  const nullOrg = await prisma.device.findMany({
    where: { organization: null },
    select: { id: true, name: true, deviceCode: true }
  })
  console.log('\n=== organization 为 NULL 的设备:', nullOrg.length)
  for (const d of nullOrg) {
    console.log('  ' + d.deviceCode + ' - ' + d.name)
  }

  // 查看 organization 为 '未分配' 的设备
  const unassigned = await prisma.device.findMany({
    where: { organization: '未分配' },
    select: { id: true, name: true, deviceCode: true, status: true }
  })
  console.log('\n=== organization = "未分配" 的设备:', unassigned.length)
  for (const d of unassigned) {
    console.log('  ' + d.deviceCode + ' - ' + d.name + ' (' + d.status + ')')
  }

  // MAC 分组情况
  const withMac = await prisma.device.findMany({
    include: { hardware: { select: { macAddress: true } } },
    orderBy: { createdAt: 'desc' }
  })
  const macGroups: Record<string, any[]> = {}
  for (const d of withMac) {
    const mac = d.hardware?.macAddress || '__NO_MAC__'
    if (!macGroups[mac]) macGroups[mac] = []
    macGroups[mac].push({ id: d.id, name: d.name, org: d.organization, createdAt: d.createdAt })
  }
  console.log('\n=== MAC 分组情况:')
  let groupCount = 0
  let multiDeviceGroups = 0
  let multiOrgGroups = 0
  for (const [mac, list] of Object.entries(macGroups)) {
    if (mac === '__NO_MAC__') {
      console.log('  无 MAC 设备数:', list.length)
      groupCount += list.length
      continue
    }
    groupCount++
    if (list.length > 1) {
      multiDeviceGroups++
      const orgs = [...new Set(list.map((d: any) => d.org || 'NULL'))]
      console.log('  MAC=' + mac + ' (' + list.length + ' devices, orgs=' + orgs.join(',') + ')')
      if (orgs.length > 1) {
        multiOrgGroups++
        console.log('    *** 跨部门!')
        for (const d of list) {
          console.log('    - ' + d.name + ' org=' + (d.org || 'NULL') + ' created=' + d.createdAt)
        }
      }
    }
  }
  console.log('\n  前端表格行数(按MAC分组后):', groupCount)
  console.log('  多设备同MAC组数:', multiDeviceGroups)
  console.log('  跨部门同MAC组数:', multiOrgGroups)

  // 汇总
  console.log('\n=== 汇总:')
  console.log('  数据库总设备数:', total)
  console.log('  前端展示行数(MAC分组后):', groupCount)
  console.log('  部门统计合计:', orgSum)
  console.log('  差异1(数据库-展示行数):', total - groupCount, '(被MAC折叠的行数)')
  if (orgSum !== total) {
    console.log('  差异2(数据库-部门合计):', total - orgSum, '(organization 为 NULL 的设备数)')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

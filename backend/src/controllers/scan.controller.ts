// 采集脚本控制器
import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import prisma from '../prisma/client'
import os from 'os'

function getServerBaseUrl(req: AuthRequest): string {
  if (process.env.BASE_URL) return process.env.BASE_URL

  // 尝试获取局域网 IP
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const port = process.env.PORT || '3000'
        return `http://${iface.address}:${port}`
      }
    }
  }

  return 'http://localhost:3000'
}

// 接收采集数据（无需 Token）
export async function submitScanData(req: AuthRequest, res: Response) {
  try {
    const hardwareData = req.body
    const requestIp = req.ip || req.socket.remoteAddress || ''

    // 验证必要字段 - 只需要 MAC 地址
    if (!hardwareData.macAddress) {
      res.status(400).json({ error: '必须提供 MAC 地址' })
      return
    }

    // 从采集的 networkCards 中提取第一个 IPv4 地址
    let collectedIpv4 = requestIp
    if (Array.isArray(hardwareData.networkCards)) {
      const ipv4Address = hardwareData.networkCards.find((nc: any) => nc.IPv4Address)?.IPv4Address
      if (ipv4Address && ipv4Address.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        collectedIpv4 = ipv4Address
      }
    }

    // 尝试通过 MAC 地址匹配现有设备
    const existingHardware = await prisma.deviceHardware.findFirst({
      where: {
        macAddress: hardwareData.macAddress,
      },
      include: {
        device: true,
      },
    })

    const deviceId = existingHardware?.device.id

    // 创建待审批记录，将 IPv4 地址存入 submitterIp
    const approval = await prisma.pendingApproval.create({
      data: {
        deviceId,
        deviceName: hardwareData.hostname || null,
        hardwareData: JSON.stringify({
          ...hardwareData,
          submitterIp: collectedIpv4,
        }),
        submitterIp: collectedIpv4,
        status: 'PENDING',
      },
    })

    res.json({
      message: '采集数据已提交，等待管理员审批',
      approvalId: approval.id,
      isUpdate: !!deviceId,
    })
  } catch (error) {
    console.error('提交采集数据错误:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 生成 Windows PowerShell 采集脚本
export function getWindowsScript(req: AuthRequest, res: Response) {
  const baseUrl = getServerBaseUrl(req)

  const script = `
# Hardware Collection Script for Windows - 电脑资产采集工具
# 请以管理员身份运行

$BaseUrl = "${baseUrl}"
$UploadUrl = "$BaseUrl/api/scan/upload"

Write-Host "========================================"
Write-Host "  电脑资产采集工具"
Write-Host "========================================"
Write-Host ""

# Get user input
Write-Host "请输入设备信息：" -ForegroundColor Yellow
$userName = Read-Host "使用人"
$location = Read-Host "位置"
$assetCode = Read-Host "资产编号"

# Validate input
if ([string]::IsNullOrWhiteSpace($userName)) {
    Write-Host "错误：必须输入使用人！" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}
if ([string]::IsNullOrWhiteSpace($location)) {
    Write-Host "错误：必须输入位置！" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}
if ([string]::IsNullOrWhiteSpace($assetCode)) {
    Write-Host "错误：必须输入资产编号！" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}

Write-Host ""
Write-Host "正在采集硬件信息..."
Write-Host ""

# CPU
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cpuInfo = "$($cpu.Name) ($($cpu.NumberOfCores) cores)"

# Memory
$memory = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
$memoryGB = [math]::Round($memory.Sum / 1GB, 2)
$memoryCount = $memory.Count
$memoryInfo = "$memoryGB GB ($memoryCount modules)"

# Disk
$disks = Get-CimInstance Win32_DiskDrive | ForEach-Object {
    @{Model = $_.Model; SizeGB = [math]::Round($_.Size / 1GB, 2)}
}

# GPU
$gpus = Get-CimInstance Win32_VideoController | ForEach-Object {
    @{Name = $_.Name}
}

# Network (IPv4 only)
$networkAdapters = Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.MACAddress -ne $null -and $_.NetConnectionStatus -eq 2 -and $_.AdapterTypeId -eq 0 } | ForEach-Object {
    $idx = $_.InterfaceIndex
    $ipConfig = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "InterfaceIndex=$idx" | Where-Object { $_.IPAddress -ne $null }
    $ipv4 = $null
    if ($ipConfig.IPAddress) {
        foreach ($ip in $ipConfig.IPAddress) {
            if ($ip -match '^\\d+\\.\\d+\\.\\d+\\.\\d+$') { $ipv4 = $ip; break }
        }
    }
    @{Name = $_.Name; MACAddress = $_.MACAddress; IPv4Address = $ipv4}
}

# Motherboard
$motherboard = Get-CimInstance Win32_BaseBoard
$moboInfo = "$($motherboard.Manufacturer) $($motherboard.Product)"

# OS
$os = Get-CimInstance Win32_OperatingSystem
$osInfo = "$($os.Caption) $($os.OSArchitecture)"

# Hostname
$hostname = $env:COMPUTERNAME

# MAC Address
$macAddress = ($networkAdapters | Select-Object -First 1).MACAddress

# Build data object
$hardwareData = @{
    hostname = $hostname
    assetCode = $assetCode
    userName = $userName
    location = $location
    cpu = $cpuInfo
    memory = $memoryInfo
    disk = $disks
    gpu = $gpus
    networkCards = $networkAdapters
    motherboard = $moboInfo
    os = $osInfo
    macAddress = $macAddress
    collectedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

# Display summary
Write-Host ""
Write-Host "========================================"
Write-Host "采集摘要："
Write-Host "========================================"
Write-Host "资产编号：$assetCode"
Write-Host "使用人：   $userName"
Write-Host "位置：   $location"
Write-Host "主机名：   $hostname"
Write-Host "CPU：        $cpuInfo"
Write-Host "内存：     $memoryInfo"
Write-Host ""
Write-Host "正在上传到服务器..."

# Upload data
try {
    $json = $hardwareData | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $UploadUrl -Method POST -Body $json -ContentType "application/json; charset=utf-8"

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  上传成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "消息：$($response.message)"
    if ($response.isUpdate) {
        Write-Host "注意：将更新现有设备记录" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "等待管理员审批..." -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  上传失败！" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "错误：$_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查：" -ForegroundColor Yellow
    Write-Host "1. 网络连接" -ForegroundColor Yellow
    Write-Host "2. 后端服务是否在运行：$BaseUrl" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "窗口将在 3 秒后自动关闭..." -ForegroundColor Gray
Start-Sleep -Seconds 3
`

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="collect_windows.ps1"')
  res.send('﻿' + script)
}

// 生成 Linux Bash 采集脚本
export function getLinuxScript(req: AuthRequest, res: Response) {
  const baseUrl = getServerBaseUrl(req)

  const script = `#!/bin/bash
# Hardware Collection Script for Linux

BASE_URL="${baseUrl}"
UPLOAD_URL="$BASE_URL/api/scan/upload"

echo "正在采集硬件信息..."

HOSTNAME=$(hostname)
CPU_NAME=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
CPU_CORES=$(grep -c "^processor" /proc/cpuinfo)
MEM_TOTAL=$(free -g | awk '/^Mem:/ {print $2}')
MAC_ADDR=$(ip -o link show 2>/dev/null | awk -F': ' '/^[0-9]+: (eth|enp|eno|ens)/{print $2; exit}')

echo "请输入设备信息："
read -p "使用人：" userName
read -p "位置：" location
read -p "资产编号：" assetCode

if [ -z "$userName" ] || [ -z "$location" ] || [ -z "$assetCode" ]; then
    echo "错误：所有字段都必须填写！"
    exit 1
fi

cat > /tmp/hardware_data.json << EOF
{
  "hostname": "$HOSTNAME",
  "assetCode": "$assetCode",
  "userName": "$userName",
  "location": "$location",
  "cpu": "$CPU_NAME ($CPU_CORES cores)",
  "memory": "\${MEM_TOTAL}GB",
  "macAddress": "$MAC_ADDR",
  "collectedAt": "$(date '+%Y-%m-%d %H:%M:%S')"
}
EOF

RESPONSE=$(curl -s -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/json" \
  -d @/tmp/hardware_data.json)

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "error"; then
    echo "上传失败"
    exit 1
else
    echo "上传成功！"
    echo "等待管理员审批..."
fi

rm -f /tmp/hardware_data.json
`

  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Content-Disposition', 'attachment; filename="collect_linux.sh"')
  res.send(script)
}
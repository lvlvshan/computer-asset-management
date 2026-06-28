# 电脑资产信息采集脚本
param([string]$Token)

$BaseUrl = "http://localhost:3000"
$UploadUrl = "$BaseUrl/api/scan/upload?token=$Token"

Write-Host "正在采集硬件信息..." -ForegroundColor Cyan
Write-Host ""

try {
    # 采集 CPU 信息
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $cpuName = $cpu.Name
    $cpuCores = $cpu.NumberOfCores
    $cpuThreads = $cpu.NumberOfLogicalProcessors

    # 采集内存信息
    $memory = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
    $memoryGB = [math]::Round($memory.Sum / 1GB, 2)
    $memoryModules = $memory.Count

    # 采集硬盘信息
    $disks = Get-CimInstance Win32_DiskDrive | ForEach-Object {
        [PSCustomObject]@{
            Model = $_.Model
            SizeGB = [math]::Round($_.Size / 1GB, 2)
        }
    }

    # 采集显卡信息
    $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
    $gpuName = $gpu.Name

    # 采集网卡信息
    $networkAdapter = Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.MACAddress -ne $null -and $_.PhysicalAdapter -eq $true } | Select-Object -First 1
    $macAddress = $networkAdapter.MACAddress
    $networkName = $networkAdapter.Name

    # 采集主板信息
    $motherboard = Get-CimInstance Win32_BaseBoard
    $moboManufacturer = $motherboard.Manufacturer
    $moboProduct = $motherboard.Product
    $moboSerial = $motherboard.SerialNumber

    # 采集操作系统信息
    $os = Get-CimInstance Win32_OperatingSystem
    $osCaption = $os.Caption
    $osArch = $os.OSArchitecture

    # 获取主机名
    $hostname = $env:COMPUTERNAME

    # 组装数据
    $hardwareData = [PSCustomObject]@{
        hostname = $hostname
        cpu = "$cpuName ($cpuCores 核$cpuThreads 线程)"
        memory = "${memoryGB}GB ($memoryModules 条)"
        disk = ($disks | ForEach-Object { "$($_.Model) $($_.SizeGB)GB" }) -join ", "
        gpu = $gpuName
        networkCards = @(
            @{
                name = $networkName
                mac = $macAddress
            }
        )
        motherboard = "$moboManufacturer $moboProduct (SN: $moboSerial)"
        os = "$osCaption $osArch"
        serialNumber = $moboSerial
        macAddress = $macAddress
        collectedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }

    Write-Host "正在上传数据到服务器..." -ForegroundColor Cyan

    # 上传数据
    $jsonBody = $hardwareData | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $UploadUrl -Method POST -Body $jsonBody -ContentType "application/json"

    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "  数据上传成功！" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "服务器响应：$($response.message)" -ForegroundColor Green
    if ($response.isUpdate) {
        Write-Host "检测到已有设备记录，已更新硬件信息" -ForegroundColor Yellow
    } else {
        Write-Host "新设备已创建，等待管理员审批" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "请按任意键关闭此窗口..." -ForegroundColor Cyan
    Read-Host | Out-Null

} catch {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "  上传失败" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "错误信息：$_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查：" -ForegroundColor Yellow
    Write-Host "  1. 网络连接是否正常" -ForegroundColor Yellow
    Write-Host "  2. Token 是否正确" -ForegroundColor Yellow
    Write-Host "  3. 服务器是否运行中" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请按任意键关闭此窗口..." -ForegroundColor Cyan
    Read-Host | Out-Null
    exit 1
}
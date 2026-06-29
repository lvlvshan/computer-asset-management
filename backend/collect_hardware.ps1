
# Hardware Collection Script for Windows
# Run as Administrator

$BaseUrl = "http://localhost:3000"
$UploadUrl = "$BaseUrl/api/scan/upload"

Write-Host "========================================"
Write-Host "  Computer Asset Collection Tool"
Write-Host "========================================"
Write-Host ""

# Get user input
Write-Host "Please enter device information:" -ForegroundColor Yellow
$userName = Read-Host "Username"
$location = Read-Host "Location"
$assetCode = Read-Host "Asset Code"

# Validate input
if ([string]::IsNullOrWhiteSpace($userName)) {
    Write-Host "Error: Username required!" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}
if ([string]::IsNullOrWhiteSpace($location)) {
    Write-Host "Error: Location required!" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}
if ([string]::IsNullOrWhiteSpace($assetCode)) {
    Write-Host "Error: Asset Code required!" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}

Write-Host ""
Write-Host "Collecting hardware information..."
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
            if ($ip -match '^\d+\.\d+\.\d+\.\d+$') { $ipv4 = $ip; break }
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
Write-Host "Summary:"
Write-Host "========================================"
Write-Host "Asset Code: $assetCode"
Write-Host "Username:   $userName"
Write-Host "Location:   $location"
Write-Host "Hostname:   $hostname"
Write-Host "CPU:        $cpuInfo"
Write-Host "Memory:     $memoryInfo"
Write-Host ""
Write-Host "Uploading to server..."

# Upload data
try {
    $json = $hardwareData | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri $UploadUrl -Method POST -Body $json -ContentType "application/json; charset=utf-8"

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Upload Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Message: $($response.message)"
    if ($response.isUpdate) {
        Write-Host "Note: Existing device record will be updated" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Waiting for admin approval..." -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Upload Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Network connection" -ForegroundColor Yellow
    Write-Host "2. Backend service running at $BaseUrl" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Window will close in 3 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 3

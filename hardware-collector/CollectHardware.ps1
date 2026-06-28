# Computer Hardware Collector with Auto-Upload
# Save as CollectHardware.ps1 with UTF-8 encoding

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Computer Hardware Collector" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Get Token from user
Write-Host "Please enter the collection Token (from Asset Management System):" -ForegroundColor Yellow
Write-Host ""
$token = Read-Host "Token"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "Error: Token cannot be empty!" -ForegroundColor Red
    Write-Host "Press Enter to exit..."
    Read-Host | Out-Null
    exit 1
}

Write-Host ""
Write-Host "Token: $token" -ForegroundColor Green
Write-Host ""
Write-Host "Collecting hardware information..." -ForegroundColor Cyan
Write-Host ""

# Collect hardware information
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$mem = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
$disk = Get-CimInstance Win32_DiskDrive
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
$nic = Get-CimInstance Win32_NetworkAdapter | Where-Object {$_.MACAddress -ne $null -and $_.PhysicalAdapter -eq $true} | Select-Object -First 1
$mobo = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem

# Display information
Write-Host "  CPU:      $($cpu.Name)" -ForegroundColor Green
Write-Host "  Memory:   $([math]::Round($mem.Sum/1GB, 2))GB ($($mem.Count) modules)" -ForegroundColor Green
Write-Host "  Disk:     $($disk.Model -join ', ')" -ForegroundColor Green
Write-Host "  GPU:      $($gpu.Name)" -ForegroundColor Green
Write-Host "  NIC:      $($nic.Name)" -ForegroundColor Green
Write-Host "  MAC:      $($nic.MACAddress)" -ForegroundColor Green
Write-Host "  Host:     $($env:COMPUTERNAME)" -ForegroundColor Green
Write-Host ""

# Create JSON data
$hw = @{
    hostname = $env:COMPUTERNAME
    cpu = "$($cpu.Name) ($($cpu.NumberOfCores) cores, $($cpu.NumberOfLogicalProcessors) threads)"
    memory = "$([math]::Round($mem.Sum/1GB, 2))GB ($($mem.Count) modules)"
    disk = ($disk.Model -join ", ")
    gpu = $gpu.Name
    networkCards = @(@{name=$nic.Name; mac=$nic.MACAddress})
    motherboard = "$($mobo.Manufacturer) $($mobo.Product) (SN: $($mobo.SerialNumber))"
    os = $os.Caption
    serialNumber = $mobo.SerialNumber
    macAddress = $nic.MACAddress
    collectedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

$json = $hw | ConvertTo-Json -Depth 10

Write-Host "Uploading data to server..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/scan/upload?token=$token" -Method POST -Body $json -ContentType "application/json"

    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "  Upload Successful!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host $response.message -ForegroundColor Green

    if ($response.isUpdate) {
        Write-Host "Device hardware info updated" -ForegroundColor Yellow
    } else {
        Write-Host "New device created, waiting for admin approval" -ForegroundColor Green
    }
} catch {
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "  Upload Failed!" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. Token is correct"
    Write-Host "  2. Server is running (http://localhost:3000)"
    Write-Host "  3. Network connection is working"
}

Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host | Out-Null
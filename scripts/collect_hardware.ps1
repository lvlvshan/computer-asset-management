# Hardware Collection Script
$BaseUrl = "http://192.168.5.17:3000"
$UploadUrl = "$BaseUrl/api/scan/upload"

Write-Host "========================================"
Write-Host "  Computer Asset Collection Tool"
Write-Host "========================================"
Write-Host ""

Write-Host "Please enter device information:" -ForegroundColor Yellow
$userName = Read-Host "Username"
$location = Read-Host "Location"
$assetCode = Read-Host "Asset Code"

if ([string]::IsNullOrWhiteSpace($userName) -or [string]::IsNullOrWhiteSpace($location) -or [string]::IsNullOrWhiteSpace($assetCode)) {
    Write-Host "Error: All fields required!" -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 1
}

Write-Host ""
Write-Host "Collecting hardware..."

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cpuInfo = "$($cpu.Name) ($($cpu.NumberOfCores) cores)"

$memory = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
$memoryInfo = "$([math]::Round($memory.Sum/1GB,2))GB"

$disks = Get-CimInstance Win32_DiskDrive | ForEach-Object { @{Model=$_.Model;SizeGB=[math]::Round($_.Size/1GB,2)} }
$gpus = Get-CimInstance Win32_VideoController | ForEach-Object { @{Name=$_.Name} }

$networkAdapters = Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.MACAddress -ne $null } | ForEach-Object {
    $idx = $_.InterfaceIndex
    $ipCfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "InterfaceIndex=$idx"
    $ipv4 = $null
    if ($ipCfg.IPAddress) {
        foreach ($ip in $ipCfg.IPAddress) {
            if ($ip -match '^\d+\.\d+\.\d+\.\d+$') { $ipv4 = $ip; break }
        }
    }
    @{Name=$_.Name;MACAddress=$_.MACAddress;IPv4Address=$ipv4}
}

$mobo = Get-CimInstance Win32_BaseBoard
$os = Get-CimInstance Win32_OperatingSystem

$hw = @{
    hostname = $env:COMPUTERNAME
    assetCode = $assetCode
    userName = $userName
    location = $location
    cpu = $cpuInfo
    memory = $memoryInfo
    disk = $disks
    gpu = $gpus
    networkCards = $networkAdapters
    motherboard = "$($mobo.Manufacturer) $($mobo.Product)"
    os = "$($os.Caption)"
    macAddress = ($networkAdapters | Select-Object -First 1).MACAddress
    collectedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

Write-Host ""
Write-Host "Summary: Asset=$assetCode | User=$userName | Location=$location"
Write-Host "CPU: $cpuInfo | Memory: $memoryInfo"

try {
    $json = $hw | ConvertTo-Json -Depth 10
    $resp = Invoke-RestMethod -Uri $UploadUrl -Method POST -Body $json -ContentType "application/json; charset=utf-8"
    Write-Host "Upload OK!" -ForegroundColor Green
    Write-Host $resp.message
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Closing in 3 seconds..."
Start-Sleep -Seconds 3
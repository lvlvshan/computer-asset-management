@echo off
setlocal enabledelayedexpansion

:: ========================================
::   电脑资产信息采集工具
::   双击即可运行，无需配置
:: ========================================

echo ========================================
echo   电脑资产信息采集工具
echo ========================================
echo.
echo 正在采集硬件信息，请稍候...
echo.

:: 获取 Token（从命令行参数或交互式输入）
if "%~1"=="" (
    goto :input_token
) else (
    set TOKEN=%~1
    goto :run_script
)

:input_token
echo 请输入采集 Token（从资产管理系统复制）:
set /p TOKEN=
if "!TOKEN!"=="" (
    echo.
    echo 错误：Token 不能为空
    echo 请按任意键退出...
    pause > nul
    exit /b 1
)

:run_script
:: 使用 Bypass 策略运行 PowerShell 脚本
powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File \"%~dpn0_collector.ps1\" -Token \"!TOKEN!\"' -Wait"

echo.
echo 采集完成！请按任意键退出...
pause > nul
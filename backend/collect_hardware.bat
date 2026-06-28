@echo off
chcp 65001 >nul
cls
echo ========================================
echo   Computer Asset Collection Tool
echo ========================================
echo.
echo Starting hardware collection...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0collect_hardware.ps1"
echo.
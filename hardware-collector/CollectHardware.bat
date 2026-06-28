@echo off
title Computer Hardware Collector
echo.
echo ========================================
echo   Computer Hardware Collector
echo ========================================
echo.
echo This tool will collect your hardware info
echo and upload it to the Asset Management System.
echo.
echo You need a Token from the system first!
echo.

:: Force UTF-8 output
chcp 65001 >nul 2>&1

:: Run PowerShell script
powershell -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '%~dpn0.ps1'"
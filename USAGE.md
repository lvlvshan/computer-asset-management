# 电脑资产管理系统 - 使用文档

## 系统简介

这是一套轻量级的电脑资产管理系统，特点如下：
- **SQLite 数据库**：无需部署数据库服务，单文件数据库
- **浏览器访问**：前后端分离，Web 界面操作
- **采集脚本**：支持 Windows PowerShell 和 Linux Bash 脚本
- **审批流程**：采集数据需管理员审批后入库
- **历史追踪**：完整的设备使用人变更历史和维修记录

## 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 普通用户 | staff | staff123 |

## 功能模块

### 1. 设备管理
- **设备列表**：查看所有设备，支持搜索和状态筛选
- **新增设备**：手动录入设备信息
- **编辑设备**：修改设备信息
- **使用人分配**：将设备分配给指定用户
- **设备归还**：将设备状态重置为闲置
- **查看详情**：查看设备完整信息，包括：
  - 基本信息（资产编号、名称、状态等）
  - 硬件配置（CPU、内存、硬盘等）
  - 使用人历史（时间线展示）
  - 维修历史记录

### 2. 审批管理（仅管理员）
- 查看待审批的采集数据
- 查看采集的硬件详情
- 审批通过：设备正式入库
- 审批拒绝：填写拒绝原因

### 3. 采集脚本
- 生成采集会话（24 小时有效）
- 下载 Windows PowerShell 脚本
- 下载 Linux Bash 脚本
- 查看采集会话历史

## 使用流程

### 新增设备（手动）
1. 登录系统
2. 进入「设备管理」→「新增设备」
3. 填写资产编号、设备名称等信息
4. 点击保存

### 新增设备（自动采集）
1. 管理员进入「采集脚本」页面
2. 点击「创建采集会话」
3. 下载对应的采集脚本（Windows/Linux）
4. 将脚本传输到目标设备
5. 在目标设备上运行脚本：
   - **Windows**：右键脚本 →「使用 PowerShell 运行」（需管理员权限）
   - **Linux**：`sudo bash collect_linux.sh <token>`
6. 脚本自动采集硬件信息并上传
7. 管理员进入「审批管理」页面审批
8. 审批通过后设备正式入库

### 分配设备给使用人
1. 进入设备详情页
2. 点击「分配使用人」
3. 选择用户和变更原因
4. 系统自动记录使用人历史

### 添加维修记录
1. 进入设备详情页
2. 进入「维修历史」标签页
3. 点击「添加维修记录」
4. 填写故障描述、维修类型等信息
5. 设备状态自动变更为「维修中」

## 技术说明

### API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/auth/login | 用户登录 | 公开 |
| GET | /api/auth/me | 获取当前用户 | 需认证 |
| GET | /api/devices | 设备列表 | 需认证 |
| GET | /api/devices/:id | 设备详情 | 需认证 |
| POST | /api/devices | 创建设备 | 管理员 |
| PUT | /api/devices/:id | 更新设备 | 管理员 |
| DELETE | /api/devices/:id | 删除设备 | 管理员 |
| POST | /api/devices/:id/allocate | 分配使用人 | 管理员 |
| POST | /api/devices/:id/return | 归还设备 | 管理员 |
| POST | /api/devices/:id/maintenance | 添加维修记录 | 管理员 |
| GET | /api/approvals | 审批列表 | 管理员 |
| POST | /api/approvals/:id/approve | 审批通过 | 管理员 |
| POST | /api/approvals/:id/reject | 审批拒绝 | 管理员 |
| POST | /api/scan/sessions | 创建采集会话 | 需认证 |
| GET | /api/scan/script/windows | 下载 Windows 脚本 | 需认证 |
| GET | /api/scan/script/linux | 下载 Linux 脚本 | 需认证 |
| POST | /api/scan/upload | 上传采集数据 | 公开（需 token）|

###  подарки

- 前端：http://localhost:5173
- 后端：http://localhost:3000
- 数据库：backend/prisma/dev.db
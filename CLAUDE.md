# CLAUDE.md
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用开发命令

### 全局命令（在项目根目录执行）
```bash
# 并行启动前后端开发服务器
npm run dev

# 构建前后端（生产环境）
npm run build

# 仅构建后端
npm run build:backend

# 仅构建前端
npm run build:frontend
```

### 后端命令（在 `backend/` 目录执行）
```bash
# 启动开发服务器（带 TypeScript 监视）
npm run dev

# 构建生产环境代码
npm run build

# 启动生产环境服务器
npm run start

# 数据库操作
npm run db:generate    # 生成 Prisma Client
npm run db:push        # 应用数据库迁移
npm run db:seed        # 创建种子数据（默认用户）
```

### 前端命令（在 `frontend/` 目录执行）
```bash
# 启动开发服务器
npm run dev

# 构建生产环境代码
npm run build

# 预览构建产物
npm run preview
```

## 架构概览

### 代码库结构
```bash
computer-asset-management/
├── backend/           # Express + TypeScript + Prisma 后端
│   ├── src/
│   │   ├── controllers/   # 业务逻辑控制器（按功能模块划分）
│   │   ├── middlewares/   # 中间件（认证、角色控制）
│   │   ├── routes/        # 路由注册
│   │   └── prisma/        # Prisma 相关（Client、Seed 数据）
│   └── prisma/            # Prisma Schema 与 SQLite 数据库
├── frontend/          # React 18 + TypeScript + Ant Design 5 前端
│   └── src/
│       ├── api/       # Axios 封装与 API 调用
│       ├── pages/     # 页面组件（按路由划分）
│       ├── stores/    # Zustand 状态管理
│       └── utils/     # 工具函数与数据处理
├── hardware-collector/ # C# 硬件采集工具（独立应用）
└── scripts/          # 采集脚本（PowerShell/Bash）
```

### 技术栈关键点
1. **认证系统**
   - JWT（jsonwebtoken 库） + Express 中间件（`authMiddleware`）
   - 支持 ADMIN/STAFF/MAINTENANCE 三种角色（`role` 字段存储于 User 模型）

2. **数据流**
   - **采集 → 审批 → 入库**：采集脚本提交数据 → 创建 `PendingApproval` 记录 → 管理员审批 → 更新/创建 Device 记录
   - **MAC 匹配逻辑**：审批时通过 MAC 地址匹配现有设备（若匹配则更新，否则新建）
   - **使用人变更**：自动记录历史（`DeviceHistoricalUser` 表），`endDate` 为 `NULL` 表示当前使用人

3. **跨模块依赖**
   - 前端使用 `@tanstack/react-query` 管理数据状态（缓存/重试/失效）
   - Axios 拦截器自动处理 401 错误（清除 localStorage 并跳转登录页）

## 关键实现细节

### 数据库设计
- **多对一关系**：`Device`（设备主表） ← `DeviceHardware`（1:1 硬件快照）
- **历史表特殊字段**：`DeviceHistoricalUser.endDate=NULL` 表示当前记录
- **事务处理**：审批/维修流程使用 `prisma.$transaction` 确保原子性

### 验证与调试
1. **后端验证**
   - 使用 Postman 测试 API（端口 `3000`）
   - 检查 SQL 日志：`DEBUG=prisma:client npm run dev`

2. **前端调试**
   - React Query Devtools 自动注入（开发环境）
   - 组件层级：使用 React DevTools 查看组件树与状态

3. **硬件采集调试**
   - Windows 脚本：`powershell.exe -ExecutionPolicy Bypass -File windows-collect.ps1`
   - 输出文件：脚本生成的临时文件保存至 `%TEMP%\hardware_info.json`

### 关键路径
1. **数据库路径解析**（2026-07-06 修复）
   - 路径：`backend/src/controllers/backup.controller.ts`
   - 修复点：确保 `getDbPath()` 返回值与 `.env` 的 `DATABASE_URL` 一致

2. **采集脚本解析**
   - 主脚本：`scripts/windows-collect.ps1`
   - 核心逻辑：`# Network & OS` 部分解析 MAC 地址和网络信息
   - 命令依赖：`Get-NetAdapter` 用于获取 MAC 地址

## 特殊操作流程

### 重置数据库
```bash
cd backend
rm prisma/dev.db        # 删除 SQLite 文件
npx prisma db push      # 重新应用 Schema
npm run db:seed         # 填充种子数据
```

### 测试环境设置
1. **API 测试**（示例）：
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' http://localhost:3000/api/auth/login
   ```

2. **集成测试配置**（当前缺失，建议补充）
   ```bash
   # 添加 Jest + React Testing Library
   cd frontend
   npm install --save-dev @testing-library/react @testing-library/jest-dom jest @types/jest
   ```

## 代码修改注意事项

1. **审批流程逻辑**（2026-07-06 关键修复点）：
   - 必须在审批创建设备时默认设置 `organization: '未分配'`（防止无部门设备）
   - 使用人历史的 `startDate` 必须使用采集时间（`collectedAt`）而非审批时间

2. **前端状态管理规范**：
   - 页面级状态使用 Zustand Store（如 `userStore.ts`）
   - 数据请求统一使用 React Query（如 `DeviceList.tsx` 中的 `useQuery`）

3. **安全要点**：
   - 修改默认 JWT_SECRET（`.env` 文件）
   - 生产环境限制 CORS 域名（当前开放所有来源）
   - 对登录接口添加速率限制（`express-rate-limit`）

## 关键问题排查

### 采集脚本无法上传数据
1. 检查服务器地址：
   - 脚本中的 `SERVER_URL` 必须与 `.env` 的 `BASE_URL` 一致
   - 确保目标电脑能访问该地址（局域网/VPN）

2. 验证数据格式：
   - 脚本输出的 `hardware_info.json` 必须包含 `macAddress` 字段
   - 检查字段命名与后端预期一致（`networkCards` 为 JSON 数组）

### 审批通过但设备未更新
1. 检查 MAC 匹配逻辑：
   - `scan.controller.ts` 中的 `findDeviceByMac()` 必须正确匹配现有设备
   - 审批记录的 `deviceId` 必须非空

2. 调试数据库事务：
   - 审批控制器中的事务块必须包含所有关联操作（设备更新 + 历史记录创建 + 审批状态更新）

```
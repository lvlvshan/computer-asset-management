# 电脑资产管理系统 — 详细设计文档

## 项目概述

全栈电脑资产管理系统，用于企业IT资产的采集、审批、追踪和管理。采用 **monorepo** 结构，包含后端（Express + Prisma + SQLite）和前端（React + Ant Design + Vite）。

## 架构总览

```
computer-asset-management/
├── backend/                    # Express API 服务
│   ├── src/
│   │   ├── index.ts           # 入口，Express 应用，端口 3000
│   │   ├── routes/index.ts    # 集中路由注册
│   │   ├── controllers/       # 业务控制器
│   │   │   ├── auth.controller.ts
│   │   │   ├── device.controller.ts
│   │   │   ├── approval.controller.ts
│   │   │   ├── scan.controller.ts
│   │   │   ├── maintenance.controller.ts
│   │   │   └── backup.controller.ts
│   │   ├── middlewares/
│   │   │   └── auth.middleware.ts  # JWT + 角色中间件
│   │   └── prisma/
│   │       ├── client.ts      # PrismaClient 单例
│   │       └── seed.ts        # 种子数据
│   ├── prisma/
│   │   └── schema.prisma      # 数据模型 7 个表
│   └── .env                   # DATABASE_URL, JWT_SECRET 等
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── main.tsx           # 入口
│   │   ├── App.tsx            # 路由 + 全局配置
│   │   ├── pages/             # 12 个页面组件
│   │   ├── api/               # API 客户端封装
│   │   │   ├── client.ts      # Axios 实例 + 拦截器
│   │   │   └── index.ts       # 类型化 API 函数
│   │   ├── stores/            # Zustand 状态管理
│   │   └── utils/             # 工具函数
│   └── vite.config.ts         # Vite 配置，proxy /api → :3000
├── hardware-collector/         # C# 硬件采集工具
└── scripts/                    # 独立采集脚本（batch/ps1）
```

## 数据库设计（7 个模型）

### User — 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | String **@unique** | 登录名 |
| password | String | bcrypt 哈希 |
| role | String | ADMIN / STAFF / MAINTENANCE（SQLite 无枚举，纯字符串）|
| createdAt | DateTime | 创建时间 |

**关联**：`usedDevices` → Device[], `historicalRecords` → DeviceHistoricalUser[], `maintainedDevices` → DeviceMaintenance[], `approvals` → PendingApproval[], `submittedMaintenances` / `approvedMaintenances` → PendingMaintenance[]

### Device — 设备主表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| deviceCode | String | 资产编号（非唯一，同 MAC 设备可共用）|
| name | String | 设备名称 |
| status | String | IN_USE / IDLE / REPAIR / SCRAPPED |
| currentUserId | String? | 当前使用人（关联 User）|
| currentUserName | String? | 当前使用人（自由文本，非系统用户）|
| organization | String? | 所属部门 |
| location | String? | 放置位置 |
| purchaseDate | DateTime? | 采购日期 |
| warrantyEnd | DateTime? | 保修截止 |

**关联**：`currentUser` → User, `hardware` → DeviceHardware (1:1), `historicalUsers` → DeviceHistoricalUser[], `maintenanceRecords` → DeviceMaintenance[], `pendingApprovals` → PendingApproval[], `pendingMaintenances` → PendingMaintenance[]

### DeviceHardware — 硬件配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| deviceId | String **@unique** | 关联设备（1:1）|
| cpu | String? | CPU 信息 |
| memory | String? | 内存信息 |
| disk | String? | 磁盘信息（JSON 数组转字符串）|
| gpu | String? | 显卡信息（JSON 数组转字符串）|
| networkCards | String? | 网卡列表 JSON |
| motherboard | String? | 主板信息 |
| os | String? | 操作系统 |
| macAddress | String? | MAC 地址 |
| submitterIp | String? | 采集来源 IP |
| collectedAt | DateTime | 采集时间 |

**设计说明**：`@unique` 约束确保每台设备只有一份最新硬件快照。设备详情页的 `hardwareVersions` 功能通过搜索同 MAC 的所有 DeviceHardware 记录实现（跨设备查询）。

### PendingApproval — 待审批采集数据表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| deviceId | String? | 关联现有设备（MAC 匹配时设置）|
| deviceName | String? | 新设备名称 |
| hardwareData | String | JSON 格式的完整硬件数据 |
| submitterIp | String? | 提交者 IP |
| assetCode | String? | 资产编号（脚本采集输入）|
| userName | String? | 使用人姓名 |
| location | String? | 位置 |
| status | String | PENDING / APPROVED / REJECTED |
| rejectedReason | String? | 拒绝原因 |
| approverId | String? | 审批人 ID |

**关键逻辑**：`deviceId` 在采集上传时由 scan.controller 通过 MAC 匹配设置。审批时如果 `deviceId` 存在则更新现有设备，否则创建新设备。

### PendingMaintenance — 待审批维修记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| deviceId | String | 关联设备 |
| maintenanceType | String | HARDWARE / SOFTWARE / OTHER |
| description | String | 故障描述 |
| solution | String? | 处理方案 |
| cost | Float? | 维修费用 |
| vendor | String? | 维修商 |
| startDate / endDate | DateTime | 送修/修复日期 |
| currentUserName | String? | 当前使用人 |
| status | String | PENDING / APPROVED / REJECTED |
| submitterId | String | 提交人（MAINTENANCE 角色）|
| approverId | String? | 审批人（ADMIN 角色）|

### DeviceHistoricalUser — 使用人历史表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| deviceId | String | 关联设备 |
| userId | String? | 系统用户 ID |
| userName | String? | 自由文本用户名 |
| changedBy | String | 操作人 ID |
| changeReason | String | 分配/调岗/归还/维修分配 |
| startDate | DateTime | 开始日期 |
| endDate | DateTime? | 结束日期（null 表示当前）|

**核心逻辑**：任何时候只有一个记录的 `endDate IS NULL`（当前使用人）。使用人变更时，系统自动将旧记录的 `endDate` 设为当前时间并创建新记录。

### DeviceMaintenance — 设备维修记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| deviceId | String | 关联设备 |
| maintenanceType | String | HARDWARE / SOFTWARE / OTHER |
| description / solution | String | 故障描述 / 处理方案 |
| cost | Float? | 费用 |
| vendor | String? | 维修商 |
| startDate / endDate | DateTime | 日期 |
| operator | String | 操作人 ID |

---

## API 端点大全

### 认证（无需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录，返回 JWT token |

### 用户管理（需 ADMIN）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 获取用户列表 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:id | 更新用户 |
| DELETE | /api/users/:id | 删除用户（级联清理关联数据）|
| POST | /api/users/:id/reset-password | 重置密码为 123456 |

### 当前用户（需认证）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/auth/me | 获取当前用户信息 |
| POST | /api/auth/change-password | 修改密码 |

### 设备管理（需认证，增删改需 ADMIN）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/devices | 设备列表（支持 search/status/location/organization/macAddress/hardware/date 筛选）|
| GET | /api/devices/:id | 设备详情（包含硬件、历史使用人、维修记录、硬件版本）|
| POST | /api/devices | 创建设备 |
| PUT | /api/devices/:id | 更新设备 |
| DELETE | /api/devices/:id | 删除设备 |
| POST | /api/devices/batch-update | 批量更新（organization/location/status）|
| POST | /api/devices/:id/allocate | 分配使用人 |
| POST | /api/devices/:id/return | 归还设备 |

### 审批管理（需 ADMIN）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/approvals | 审批列表（按 status 筛选）|
| GET | /api/approvals/:id | 审批详情 |
| POST | /api/approvals/:id/approve | 审批通过 |
| POST | /api/approvals/:id/reject | 审批拒绝 |

### 采集（无需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/scan/upload | 上传采集数据（需 MAC 地址）|
| GET | /api/scan/script/windows | 下载 Windows PowerShell 脚本 |
| GET | /api/scan/script/linux | 下载 Linux Bash 脚本 |

### 维修（MAINTENANCE 角色）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/maintenance/devices | 维修设备列表（支持 search/status）|
| POST | /api/maintenance/submit | 提交维修申请 |
| GET | /api/maintenance/my-submissions | 查看自己的提交记录 |

### 维修审批（需 ADMIN）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/maintenance/approvals | 维修审批列表 |
| GET | /api/maintenance/approvals/:id | 维修审批详情 + 历史维修记录 |
| POST | /api/maintenance/approvals/:id/approve | 审批通过 |
| POST | /api/maintenance/approvals/:id/reject | 审批拒绝 |

### 数据备份（需 ADMIN）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/backup/export | 导出 SQLite 数据库文件 |
| POST | /api/backup/import | 导入数据库文件（multipart/form-data）|

---

## 认证与授权流程

```
请求 → authMiddleware → adminMiddleware/maintenanceMiddleware → 控制器
```

1. **authMiddleware**（第 1 层）：从 `Authorization: Bearer <token>` 中解析 JWT，设置 `req.userId` 和 `req.userRole`
2. **adminMiddleware**（第 2 层）：检查 `req.userRole === 'ADMIN'`
3. **maintenanceMiddleware**（第 2 层）：检查 `req.userRole === 'MAINTENANCE'`

JWT 包含 `{ userId, role }`，有效期 24 小时，密钥来自 `JWT_SECRET` 环境变量。

---

## 核心数据流

### 采集 → 审批 → 设备流程

```
[目标电脑] → 运行采集脚本 → POST /api/scan/upload → 创建 PendingApproval
                                                          │
                                                    [MAC 匹配]
                                                    ├ 已有设备 → approval.deviceId = 设备ID
                                                    └ 新设备   → approval.deviceId = null
                                                          │
                                              [管理员审批 POST /api/approvals/:id/approve]
                                                          │
                                          ┌─────────────────┴─────────────────┐
                                     deviceId 存在（更新）               deviceId 为 null（创建）
                                          │                                  │
                                   1. 检查使用人变化                     1. 创建设备
                                   2. 结束旧使用人历史                   2. 设置使用人 + 历史
                                   3. 创建新使用人历史                   3. 创建设备硬件
                                   4. 更新设备信息
                                      （名称/位置/使用人）
                                   5. 更新硬件配置
                                          │
                                    返回更新后的设备
```

**关键设计决策**（2026-07-06 修订）：
- **历史设计（2026-07-06 之前）**：每次审批都创建新设备，通过 MAC 分组在前端合并展示。问题：同一 MAC 产生多条设备记录，导致同一资产编号分散在不同部门，统计数据不一致。
- **当前设计（2026-07-06 之后）**：
  - MAC 匹配时更新现有设备，不再创建重复。使用人变更自动记录历史。
  - 审批创建设备时默认设置 `organization: '未分配'`，确保所有设备都有部门归属。

### 审批通过逻辑（approval.controller.ts）

**更新分支**（`approval.deviceId` 存在）：
```
1. 查询旧设备
2. 比较新旧使用人
   └ 不同 → 结束旧历史（set endDate = scanTime）→ 创建新历史（startDate = scanTime, location）
3. 更新设备字段（deviceCode, name, location, currentUserName）
4. 更新硬件配置（DeviceHardware.update）
```

**创建分支**（`approval.deviceId` 为 null）：
```
1. 创建新设备（organization 默认 '未分配'，防止无部门设备）
2. 设置使用人（优先匹配系统用户 → currentUserId，否则存为 currentUserName）
3. 创建设备硬件
```

### 维修流程

```
[MAINTENANCE 用户]
  ├── GET /maintenance/devices — 查看可维修设备（含搜索）
  ├── POST /maintenance/submit — 提交维修单 → PendingMaintenance (status=PENDING)
  └── GET /maintenance/my-submissions — 查看自己的提交

[ADMIN 用户]
  ├── GET /maintenance/approvals — 查看待审批维修
  ├── POST /maintenance/approvals/:id/approve — 审批通过
  │   └── 事务：创建 DeviceMaintenance + 设设备状态为 REPAIR + 处理使用人变更
  └── POST /maintenance/approvals/:id/reject — 拒绝
```

### 使用人历史管理

变更使用人的三种途径：
1. **审批采集数据时** — 扫描数据中的 userName 与设备当前用户不同时，自动处理
2. **管理员手动分配** — `POST /api/devices/:id/allocate`
3. **设备归还** — `POST /api/devices/:id/return`（移除使用人）

历史记录字段：`startDate`、`endDate`、`location`（使用地点）

历史变更逻辑（2026-07-06 修订）：
```
采集上报时间 = hardwareData.collectedAt || approval.createdAt
使用地点     = hardwareData.location || approval.location

结束旧记录 → endDate = 新用户的采集上报时间（精确到新用户首次上报，非审批时间）
创建新记录 → startDate = 采集上报时间, location = 使用地点
更新设备   → Device.currentUser(Id|Name) = 新使用人
```

**时间准确性**：历史记录的起止时间使用采集脚本上报的 `collectedAt`（用户填写信息的时间），而非审批通过时间。这样时间线反映真实的设备使用交接时刻。

---

## 硬件采集系统

### Windows 采集脚本（PowerShell）
- 采集：CPU、内存、磁盘、显卡、网卡、主板、操作系统
- 输入：使用人、位置、资产编号（脚本交互式输入）
- 网络检测：通过路由表（`Get-NetRoute -DestinationPrefix '0.0.0.0/0'`）确定连接服务器的网卡
- 上传：`Invoke-RestMethod -Method POST -ContentType "application/json; charset=utf-8"`
- 无认证设计（适用于内网环境）

### Linux 采集脚本（Bash）
- 简化版采集：CPU、内存、MAC 地址
- 输入：使用人、位置、资产编号

### C# 硬件采集工具（hardware-collector/）
- `.csproj` + `.cs` — 独立编译的 Windows 采集程序
- `Collector.hta` — HTA 界面采集器

### 采集数据字段
```json
{
  "hostname": "PC-001",
  "assetCode": "GH-001",
  "userName": "张三",
  "location": "A栋",
  "cpu": "Intel Core i5-10400 (6 cores)",
  "memory": "16 GB (2 modules)",
  "disk": "[{Model: \"WD 1TB\", SizeGB: 931.51}]",
  "gpu": "[{Name: \"Intel UHD Graphics 630\"}]",
  "networkCards": "[{Name: \"Realtek...\", MACAddress: \"AA:BB:CC:DD:EE:FF\", IPv4Address: \"192.168.1.100\"}]",
  "motherboard": "ASUS ROG STRIX Z490",
  "os": "Windows 10 Pro 64-bit",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "primaryIp": "192.168.1.100",
  "collectedAt": "2026-07-06 12:00:00"
}
```

---

## 前端架构

### 路由与访问控制

| 路径 | 页面 | 角色 |
|------|------|------|
| /login | Login | 公开 |
| /devices | DeviceList | 任何认证用户 |
| /devices/new | DeviceForm | 任何认证用户 |
| /devices/:id | DeviceDetail | 任何认证用户 |
| /devices/:id/edit | DeviceForm | 任何认证用户 |
| /approvals | ApprovalList | ADMIN |
| /maintenance/devices | MaintenanceDeviceList | MAINTENANCE |
| /maintenance/devices/:id/maintenance | MaintenanceForm | MAINTENANCE |
| /maintenance/my-submissions | MaintenanceHistory | MAINTENANCE |
| /maintenance/approvals | MaintenanceApprovalList | ADMIN |
| /data-management | DataManagement | ADMIN |
| /users | UserManagement | ADMIN |

### 技术栈
- **状态管理**：Zustand（`stores/userStore.ts`）
- **数据获取**：@tanstack/react-query（缓存、重试、失效）
- **UI 框架**：Ant Design v5（中文 locale）
- **HTTP 客户端**：Axios（JWT 拦截器 + 401 自动登出）
- **Excel 导出**：xlsx（`utils/export.ts`）

### Axios 拦截器关键行为
- **请求拦截器**：自动附加 `Authorization: Bearer <token>`
- **响应拦截器**：401 状态码 → 清除 localStorage + 跳转 /login
- **transformRequest**：对非 FormData 请求自动 `JSON.stringify` 并设置 `Content-Type: application/json`；FormData 请求跳过转换（2026-07-06 修复）

---

## 前端页面详细逻辑

### DeviceList — 设备列表
- **主要查询**：`apiClient.get('/devices', { params })` 获取全部设备（无分页）
- **MAC 分组**：前端 `useMemo` 按 MAC 地址分组，同 MAC 的多条设备合并为一行（最新为主行，其余为子行），通过 Table 展开行展示
- **搜索筛选**：基础搜索（名称/编号/使用人）+ 状态选择 + 高级筛选（位置/部门/MAC/硬件信息/审批日期范围）
- **批量操作**：勾选多台设备 → 批量修改部门/位置/状态
- **分页**：Ant Design Table 客户端分页，支持 10/20/50/100/所有行

### ApprovalList — 审批列表
- **分类展示**：Ant Design Tabs 分三类：待审批（默认）、已通过、已拒绝
- **审批操作**：查看硬件详情 → 通过/拒绝（含理由）
- **审批通过**：`POST /api/approvals/:id/approve` → 自动创建设备或更新现有设备

### DeviceDetail — 设备详情
- **展示**：基本信息 + 硬件配置 + 使用人历史时间线 + 维修记录 + 硬件版本对比
- **硬件版本**：查询同 MAC 的所有 DeviceHardware 记录（`hardwareVersions`）

### DataManagement — 数据管理
- **导出**：`GET /api/backup/export` 下载 `.db` 文件
- **导入**：Upload 组件选择 `.db` 文件 → `POST /api/backup/import`（multipart/form-data）
- **自动预备份**：导入前自动将当前数据库复制为 `dev-pre-{timestamp}.db`

---

## 后端关键设计模式

### 控制器模式
- 所有控制器函数签名：`(req: AuthRequest, res: Response)`
- 错误处理：所有 handler 包裹在 `try/catch` 中，失败时 `res.status(500).json({ error: '服务器错误' })` + `console.error`
- 显式返回：每个 handler 显式调用 `res.status().json()` 并 `return`（不依赖 Express next()）

### 事务处理
- 设备审批、维修审批、用户删除等操作使用 `prisma.$transaction`
- 确保跨表操作原子性：设备创建 + 历史记录 + 审批状态更新在同一事务

### 数据库路径解析
```typescript
// backup.controller.ts — getDbPath()
// 解析 DATABASE_URL (file:./dev.db) 为绝对路径
// 相对路径基于 prisma/ 目录解析（与 Prisma schema 位置一致）
// 2026-07-06 修复：之前解析到 backend/ 根目录，与 Prisma 实际路径不一致
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 后端端口 |
| DATABASE_URL | file:./dev.db | SQLite 数据库路径 |
| JWT_SECRET | your-secret-key-change-in-production | JWT 签名密钥 |
| BASE_URL | (自动检测 LAN IP) | 采集脚本中的服务器地址 |
| DEFAULT_USER_PASSWORD | Chang3MePl3ase! | 自动创建用户时的默认密码 |

---

## 关键部署安全注意事项

1. **JWT_SECRET**：生成随机 64 字符 hex 串
2. **默认密码**：修改 seed.ts 中的 admin/staff/maintenance 密码
3. **CORS**：限制 `cors()` 到特定域名（当前允许所有来源）
4. **Helmet**：添加安全头中间件
5. **速率限制**：在 `/auth/login` 和 `/scan/upload` 添加 `express-rate-limit`
6. **HTTPS**：使用反向代理（nginx/Caddy）TLS 终止
7. **采集上传无认证**：当前设计依赖内网安全，生产环境应添加 IP 白名单

---

## 开发命令

```bash
# 安装依赖
npm install && cd backend && npm install && cd ../frontend && npm install && cd ..

# 重置数据库
rm backend/prisma/dev.db && cd backend && npx prisma db push && npx tsx src/prisma/seed.ts

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# 运行
npm run dev    # 并发启动前后端
```

---

## 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| ADMIN | admin | admin123 |
| STAFF | staff | staff123 |
| MAINTENANCE | maintenance | maint123 |

---

## 近期重要修复记录

| 日期 | 描述 |
|------|------|
| 2026-07-06 | **审批创建默认部门**：审批创建设备时默认设置 `organization: '未分配'`，防止无部门设备在列表中显示异常 |
| 2026-07-06 | **使用人历史记录时间和地点**：历史起止时间改用采集上报时间而非审批时间，新增 `location` 字段记录使用地点 |
| 2026-07-06 | **同 MAC 审批更新而非新建**：修复因每次审批都创建设备导致同一资产编号分散在多个部门的问题 |
| 2026-07-06 | **清理跨部门重复数据**：删除 40 台跨部门重复设备，合并使用人历史和维修记录 |
| 2026-07-06 | **备份路径不一致修复**：备份控制器解析 `DATABASE_URL` 到错误路径，导致备份/恢复对实际应用数据无效 |
| 2026-07-06 | **数据上传修复**：全局 `transformRequest` 对 FormData 执行 `JSON.stringify` 导致文件上传为空 |
| 2026-07-06 | **分页"所有"选项修复**：`pageSizeOptions` 的 `{ value, label }` 对象格式在 Ant Design v5 中不被支持，改为通过 `showSizeChanger.options` 实现 |

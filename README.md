# 电脑资产管理系统

轻量级的电脑资产管理系统，支持设备管理、硬件自动采集、审批入库、维修追踪。

## 功能特性

- **设备管理** — 设备 CRUD、分配使用人、状态管理（使用中/闲置/维修/报废）
- **硬件自动采集** — 通过 PowerShell/Bash 脚本自动采集目标电脑的硬件信息
- **审批流程** — 采集数据需管理员审批后才能正式入库
- **维修管理** — 维修人员提交维修申请 → 管理员审批 → 记录归档
- **历史追踪** — 完整的设备使用人变更历史和维修记录
- **用户管理** — 支持 ADMIN / STAFF / MAINTENANCE 三种角色
- **数据备份** — 数据库一键导出/导入恢复

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Ant Design 5 + Zustand + React Query |
| 后端 | Node.js + Express + TypeScript + Prisma ORM |
| 数据库 | SQLite（零部署，单文件） |
| 采集脚本 | Windows PowerShell / Linux Bash / C# 采集器 |

## 快速开始

### 环境要求

- Node.js >= 18

### 安装 & 启动

```bash
# 1. 安装依赖
npm install
cd backend && npm install
cd ../frontend && npm install

# 2. 初始化数据库
cd backend
npx prisma generate
npx prisma db push

# 3. 创建默认账户
npm run db:seed

# 4. 启动开发服务器（前后端同时启动）
cd .. && npm run dev
```

访问 http://localhost:5173

### 默认账户

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | admin123 | 全部权限 |
| 普通用户 | staff | staff123 | 查看设备、下载采集脚本 |
| 维修人员 | maintenance | maint123 | 提交维修申请 |

> **⚠️ 安全提示**: 部署到生产环境前，请务必修改默认密码和 JWT_SECRET。

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
PORT=3000                    # 后端端口
JWT_SECRET=your-secret-key   # JWT 签名密钥（生产环境务必修改）
BASE_URL=                    # 服务地址（留空自动检测局域网 IP）
NODE_ENV=development         # 运行环境
```

## 项目结构

```
computer-asset-management/
├── backend/                 # Express API 服务
│   ├── src/
│   │   ├── controllers/     # 业务逻辑控制器
│   │   ├── middlewares/     # JWT 认证 & 角色中间件
│   │   ├── routes/          # 路由注册
│   │   └── prisma/          # Prisma 客户端 & 种子数据
│   └── prisma/              # 数据库 Schema & SQLite 文件
├── frontend/                # React 前端应用
│   └── src/
│       ├── api/             # Axios 客户端 & API 函数
│       ├── pages/           # 页面组件
│       ├── stores/          # Zustand 状态管理
│       └── utils/           # 工具函数
├── hardware-collector/      # C# / HTA 硬件采集工具
└── scripts/                 # 独立采集脚本（备选方案）
```

## 使用流程

### 手动添加设备
1. 管理员登录 → 设备管理 → 新增设备
2. 填写资产编号、名称等信息 → 保存

### 自动采集设备
1. 管理员登录 → 下载采集脚本 → 传输到目标电脑
2. 在目标电脑运行脚本（需管理员权限）
3. 脚本自动采集硬件信息并上传至服务器
4. 管理员登录 → 审批管理 → 审批通过 → 设备自动入库

### 维修流程
1. 维修人员登录 → 提交维修申请
2. 管理员审批 → 自动创建维修记录，设备状态变为"维修中"
3. 维修完成 → 更新维修记录，设备恢复使用

## License

MIT

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Install dependencies (root, then workspaces)
npm install
cd backend && npm install
cd ../frontend && npm install

# Initialize database
cd backend
npx prisma generate
npx prisma db push
npm run db:seed   # Creates default accounts

# Start dev servers (concurrently from root)
npm run dev       # Backend :3000, Frontend :5173

# Or start individually
cd backend && npm run dev    # http://0.0.0.0:3000
cd frontend && npm run dev   # http://localhost:5173
```

### Default Accounts

| Role | Username | Password |
|------|----------|----------|
| ADMIN | admin | admin123 |
| STAFF | staff | staff123 |
| MAINTENANCE | maintenance | maint123 |

### Common Commands

```bash
# Type check (no emit — uses tsx for runtime)
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Prisma — schema changes
cd backend
npx prisma generate      # Regenerate client after schema change
npx prisma db push        # Push schema to SQLite (no migrations needed)
npx prisma studio         # Open Prisma GUI at :5555
npx prisma validate       # Validate schema
npm run db:seed           # Reset seed data
npm run build             # Production build
cd backend && npm run start  # Run compiled production build
```

## Architecture Overview

**Monorepo with npm workspaces** — `backend/` (Express API) and `frontend/` (React SPA). SQLite database via Prisma ORM.

### Backend (`backend/`)

| Component | Pattern |
|-----------|---------|
| **Entry** | `src/index.ts` — Express app on port 3000, CORS enabled, `/api` prefix |
| **Routes** | `src/routes/index.ts` — Central router registration with middleware per route |
| **Controllers** | `src/controllers/*.ts` — auth, device, approval, scan, maintenance, backup |
| **Middleware** | `src/middlewares/auth.middleware.ts` — JWT verification + role check (ADMIN, MAINTENANCE) |
| **Database** | SQLite via Prisma (`backend/prisma/schema.prisma`) |
| **Prisma Client** | `src/prisma/client.ts` — Singleton PrismaClient export with dev logging |
| **Auth** | bcrypt password hashing, JWT (24h expiry, secret via `JWT_SECRET` env var), role-based access |

**Three user roles:**
- `ADMIN` — full access: device CRUD, approval, user management, data backup/restore
- `STAFF` — basic read-only: view devices, download scan scripts
- `MAINTENANCE` — repair workflow: view devices, submit maintenance requests, track submissions

**Controller patterns:**
- All controllers import `AuthRequest` from `middlewares/auth.middleware.ts` (extends Express `Request` with `userId` and `userRole`)
- Every handler wrapped in `try/catch` with `console.error` and `res.status(500).json({ error: '服务器错误' })` fallback
- Controllers explicitly call `res.status().json()` and `return` — no async error forwarding via `next()`
- Scan controller uses `os.networkInterfaces()` to auto-detect server LAN IP for generated scripts

**Key Prisma entities:**

| Model | Purpose | Key fields |
|-------|---------|------------|
| `User` | Auth + role | username, password, role (ADMIN/STAFF/MAINTENANCE) |
| `Device` | Asset tracking | deviceCode, status (IN_USE/IDLE/REPAIR/SCRAPPED), currentUserId, organization, location |
| `DeviceHardware` | Hardware spec | 1:1 with Device; cpu, memory, disk, gpu, macAddress, networkCards (JSON) |
| `PendingApproval` | Scan data awaiting admin approval | hardwareData (JSON), status (PENDING/APPROVED/REJECTED), assetCode, userName |
| `PendingMaintenance` | Repair request awaiting admin approval | maintenanceType (HARDWARE/SOFTWARE/OTHER), submitterId (MAINTENANCE role), approverId |
| `DeviceHistoricalUser` | Usage history log | deviceId, userId, changedBy, changeReason, startDate, endDate |
| `DeviceMaintenance` | Completed repair records | deviceId, maintenanceType, cost, vendor, operator |

### Frontend (`frontend/`)

| Component | Pattern |
|-----------|---------|
| **Entry** | `src/main.tsx` |
| **Router** | `src/App.tsx` — React Router v6, protected routes with role checks |
| **State** | Zustand (`stores/userStore.ts`), React Query (`@tanstack/react-query`) |
| **UI** | Ant Design v5, Chinese locale (`zhCN`) |
| **HTTP** | Axios with JWT interceptor (`api/client.ts`), 401 → logout redirect, charset enforcement |
| **API Layer** | `api/index.ts` — Typed API functions grouped by module (authApi, deviceApi, approvalApi, scanApi, maintenanceApi, backupApi, userApi) |

**Protected route logic** (`App.tsx`):
- `ProtectedRoute` component checks `localStorage` token and role
- `requireAdmin` — only ADMIN role can access (approvals, user management, data management)
- `requireMaintenance` — only MAINTENANCE role can access (maintenance device list, submissions)

**Pages and access:**
- `Login` — public
- `DeviceList`, `DeviceDetail`, `DeviceForm` — authenticated (any role)
- `ApprovalList` — admin only
- `UserManagement` — admin only
- `DataManagement` — admin only (backup/restore)
- `MaintenanceDeviceList`, `MaintenanceForm`, `MaintenanceHistory` — MAINTENANCE role only
- `MaintenanceApprovalList` — admin only

### Data Flow: Scan → Approval → Device

1. **Admin creates devices manually** → `POST /devices` → SQLite
2. **User downloads scan script** → `GET /scan/script/windows` or `/linux` → dynamically generated PowerShell/Bash with auto-detected server URL
3. **Script runs on target machine** → collects hardware (CPU, memory, disk, GPU, network, MAC) → `POST /scan/upload` → creates `PendingApproval` (no auth required)
4. **Admin reviews in ApprovalList** → views parsed hardware JSON → approves or rejects
5. **Approval approved** → `POST /approvals/:id/approve` → creates/updates `Device` + `DeviceHardware` + optionally creates/finds user + logs historical user allocation (all in Prisma transaction)

### Maintenance Workflow

1. **MAINTENANCE user** views device list → submits repair request with fault description → creates `PendingMaintenance` (status PENDING)
2. **ADMIN user** reviews pending maintenance → approves → creates `DeviceMaintenance` record + sets device status to REPAIR + optionally reallocates user
3. **Device status** changes: REPAIR during maintenance, IN_USE on completion (`PUT /maintenance/:id/complete`)

### Hardware Collector (`hardware-collector/` & `scripts/`)

- `collect_hardware.bat` / `.ps1` — standalone Windows hardware collection scripts (fallback)
- `HardwareCollector.cs` / `.csproj` — C# hardware collector application
- `Collector.hta` — HTA-based collector UI for Windows batch collection
- These are alternatives to the dynamically generated scripts from `GET /scan/script/windows`

### Backup & Restore

- `GET /backup/export` — downloads SQLite database file (`dev.db`)
- `POST /backup/import` — uploads a `.db` file to restore; auto-creates pre-restore backup
- Both admin-only

### Key Technical Notes

- **SQLite** does not support enums; all enum-like fields are stored as plain strings in Prisma schema
- **API base**: frontend Vite proxy routes `/api` to backend; Axios client uses relative `/api` prefix
- **CORS**: backend enables all origins (suitable for LAN deployment; restrict in production)
- **Error responses**: consistently `{ error: '中文错误消息' }` with status 400/401/403/404/500
- **JWT secret**: defaults to `'your-secret-key-change-in-production'`; override via `JWT_SECRET` env var
- **Password rules**: minimum 6 characters; default reset password is `123456`
- **Port**: backend defaults to 3000; override via `PORT` env var
- **BASE_URL env var**: if set, used as the server URL in generated scan scripts (otherwise auto-detects LAN IP)
- **DEFAULT_USER_PASSWORD env var**: password for users auto-created during approval/maintenance workflows (default: `Chang3MePl3ase!`)
- **Export**: frontend supports Excel export via `xlsx` library (`utils/export.ts`)
- **DB path**: `backend/prisma/dev.db`

## Security Hardening (Before Production)

- **JWT_SECRET**: generate a random 64-char hex string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- **Default passwords**: change all default account passwords in seed.ts
- **CORS**: restrict `app.use(cors())` to specific origins
- **Helmet**: add `helmet` middleware for security headers
- **Rate limiting**: add `express-rate-limit` on auth and scan upload routes
- **HTTPS**: deploy behind a reverse proxy (nginx/Caddy) with TLS
- **DEFAULT_USER_PASSWORD**: change the env var from the default; auto-created users during approval share this password
- **Scan upload**: is unauthenticated by design; deploy on a trusted network or add IP allowlisting

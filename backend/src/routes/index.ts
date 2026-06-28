// 路由配置
import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import * as deviceController from '../controllers/device.controller'
import * as approvalController from '../controllers/approval.controller'
import * as scanController from '../controllers/scan.controller'
import * as maintenanceController from '../controllers/maintenance.controller'
import * as backupController from '../controllers/backup.controller'
import { authMiddleware, adminMiddleware, maintenanceMiddleware } from '../middlewares/auth.middleware'

const router = Router()

// 认证路由（无需认证）
router.post('/auth/login', authController.login)

// 用户管理路由（需要管理员权限）
router.get('/users', authMiddleware, adminMiddleware, authController.getUserList)
router.post('/users', authMiddleware, adminMiddleware, authController.createUser)
router.put('/users/:id', authMiddleware, adminMiddleware, authController.updateUser)
router.delete('/users/:id', authMiddleware, adminMiddleware, authController.deleteUser)
router.post('/users/:id/reset-password', authMiddleware, adminMiddleware, authController.resetPassword)

// 当前用户信息
router.get('/auth/me', authMiddleware, authController.getCurrentUser)
// 修改密码
router.post('/auth/change-password', authMiddleware, authController.changePassword)

// 设备管理路由
router.get('/devices', authMiddleware, deviceController.getDeviceList)
router.get('/devices/:id', authMiddleware, deviceController.getDeviceDetail)
router.post('/devices', authMiddleware, adminMiddleware, deviceController.createDevice)
router.put('/devices/:id', authMiddleware, adminMiddleware, deviceController.updateDevice)
router.delete('/devices/:id', authMiddleware, adminMiddleware, deviceController.deleteDevice)
router.post('/devices/batch-update', authMiddleware, adminMiddleware, deviceController.batchUpdateDevices)

// 设备使用人分配
router.post('/devices/:id/allocate', authMiddleware, adminMiddleware, deviceController.allocateUser)
router.post('/devices/:id/return', authMiddleware, adminMiddleware, deviceController.returnDevice)

// 设备维修记录
router.post('/devices/:id/maintenance', authMiddleware, adminMiddleware, deviceController.addMaintenanceRecord)
router.put('/maintenance/:id/complete', authMiddleware, adminMiddleware, deviceController.completeMaintenance)

// 审批管理路由（需要管理员权限）
router.get('/approvals', authMiddleware, adminMiddleware, approvalController.getPendingApprovals)
router.get('/approvals/:id', authMiddleware, adminMiddleware, approvalController.getApprovalDetail)
router.post('/approvals/:id/approve', authMiddleware, adminMiddleware, approvalController.approveApproval)
router.post('/approvals/:id/reject', authMiddleware, adminMiddleware, approvalController.rejectApproval)

// 采集数据上传（无需认证）
router.post('/scan/upload', scanController.submitScanData)

// 采集脚本下载（无需认证）
router.get('/scan/script/windows', scanController.getWindowsScript)
router.get('/scan/script/linux', scanController.getLinuxScript)

// 维修人员路由
router.get('/maintenance/devices', authMiddleware, maintenanceMiddleware, maintenanceController.getDevicesForMaintenance)
router.post('/maintenance/submit', authMiddleware, maintenanceMiddleware, maintenanceController.submitMaintenance)
router.get('/maintenance/my-submissions', authMiddleware, maintenanceMiddleware, maintenanceController.getMySubmissions)

// 维修审批路由（管理员）
router.get('/maintenance/approvals', authMiddleware, adminMiddleware, maintenanceController.getPendingMaintenanceApprovals)
router.get('/maintenance/approvals/:id', authMiddleware, adminMiddleware, maintenanceController.getMaintenanceApprovalDetail)
router.post('/maintenance/approvals/:id/approve', authMiddleware, adminMiddleware, maintenanceController.approveMaintenance)
router.post('/maintenance/approvals/:id/reject', authMiddleware, adminMiddleware, maintenanceController.rejectMaintenance)

// 数据备份路由（管理员）
router.get('/backup/export', authMiddleware, adminMiddleware, backupController.exportDatabase)
router.post('/backup/import', authMiddleware, adminMiddleware, backupController.uploadMiddleware, backupController.importDatabase)

export default router
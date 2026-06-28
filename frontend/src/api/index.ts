// API 调用函数
import apiClient from './client'

export interface LoginParams {
  username: string
  password: string
}

export interface User {
  id: string
  username: string
  role: 'ADMIN' | 'STAFF' | 'MAINTENANCE'
}

export interface Device {
  id: string
  deviceCode: string
  name: string
  status: 'IN_USE' | 'IDLE' | 'REPAIR' | 'SCRAPPED'
  currentUserId?: string
  currentUser?: { id: string; username: string }
  organization?: string
  location?: string
  purchaseDate?: string
  warrantyEnd?: string
  createdAt: string
}

export interface Approval {
  id: string
  deviceId?: string
  deviceName?: string
  hardwareData: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectedReason?: string
  createdAt: string
  device?: { id: string; deviceCode: string; name: string }
  approver?: { id: string; username: string }
}

// 认证相关
export const authApi = {
  login: (data: LoginParams) => apiClient.post('/auth/login', data),
  getCurrentUser: () => apiClient.get('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    apiClient.post('/auth/change-password', data),
}

// 用户相关
export const userApi = {
  getList: () => apiClient.get('/users'),
  create: (data: { username: string; password: string; role?: string }) => apiClient.post('/users', data),
  update: (id: string, data: { username?: string; role?: string }) => apiClient.put(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  resetPassword: (id: string) => apiClient.post(`/users/${id}/reset-password`),
}

// 设备相关
export const deviceApi = {
  getList: (params?: {
    status?: string
    organization?: string
    currentUserId?: string
    search?: string
    location?: string
    macAddress?: string
    hardware?: string
    fromApprovalDate?: string
    toApprovalDate?: string
  }) =>
    apiClient.get('/devices', { params }),
  getDetail: (id: string) => apiClient.get(`/devices/${id}`),
  create: (data: Partial<Device>) => apiClient.post('/devices', data),
  update: (id: string, data: Partial<Device>) => apiClient.put(`/devices/${id}`, data),
  delete: (id: string) => apiClient.delete(`/devices/${id}`),
  allocateUser: (id: string, data: { userId: string; reason?: string }) =>
    apiClient.post(`/devices/${id}/allocate`, data),
  returnDevice: (id: string) => apiClient.post(`/devices/${id}/return`),
  addMaintenance: (id: string, data: any) => apiClient.post(`/devices/${id}/maintenance`, data),
  batchUpdate: (data: { ids: string[]; updates: { organization?: string; location?: string; status?: string } }) =>
    apiClient.post('/devices/batch-update', data),
}

// 审批相关
export const approvalApi = {
  getList: (params?: { status?: string }) => apiClient.get('/approvals', { params }),
  getDetail: (id: string) => apiClient.get(`/approvals/${id}`),
  approve: (id: string) => apiClient.post(`/approvals/${id}/approve`),
  reject: (id: string, data: { reason: string }) => apiClient.post(`/approvals/${id}/reject`, data),
}

// 采集脚本相关
export const scanApi = {
  getWindowsScript: () => apiClient.get('/scan/script/windows', { responseType: 'blob' }),
  getLinuxScript: () => apiClient.get('/scan/script/linux', { responseType: 'blob' }),
}

// 维修相关
export const maintenanceApi = {
  getDevices: (params?: { status?: string; search?: string }) =>
    apiClient.get('/maintenance/devices', { params }),
  submitMaintenance: (data: any) =>
    apiClient.post('/maintenance/submit', data),
  getMySubmissions: () =>
    apiClient.get('/maintenance/my-submissions'),
  getApprovals: (params?: { status?: string }) =>
    apiClient.get('/maintenance/approvals', { params }),
  getApprovalDetail: (id: string) =>
    apiClient.get(`/maintenance/approvals/${id}`),
  approve: (id: string) =>
    apiClient.post(`/maintenance/approvals/${id}/approve`),
  reject: (id: string, data: { reason: string }) =>
    apiClient.post(`/maintenance/approvals/${id}/reject`, data),
}

// 备份恢复相关
export const backupApi = {
  exportDatabase: () =>
    apiClient.get('/backup/export', { responseType: 'blob' }),
  importDatabase: (file: File) => {
    const formData = new FormData()
    formData.append('database', file)
    return apiClient.post('/backup/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
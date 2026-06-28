import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import Login from './pages/Login'
import Layout from './pages/Layout'
import DeviceList from './pages/DeviceList'
import DeviceDetail from './pages/DeviceDetail'
import DeviceForm from './pages/DeviceForm'
import ApprovalList from './pages/ApprovalList'
import MaintenanceDeviceList from './pages/MaintenanceDeviceList'
import MaintenanceForm from './pages/MaintenanceForm'
import MaintenanceHistory from './pages/MaintenanceHistory'
import MaintenanceApprovalList from './pages/MaintenanceApprovalList'
import UserManagement from './pages/UserManagement'
import DataManagement from './pages/DataManagement'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// 保护路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean; requireMaintenance?: boolean }> = ({
  children,
  requireAdmin,
  requireMaintenance,
}) => {
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('userRole')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && userRole !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  if (requireMaintenance && userRole !== 'MAINTENANCE') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

const InnerApp: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1890ff' } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/devices" replace />} />
            <Route path="devices" element={<DeviceList />} />
            <Route path="devices/new" element={<DeviceForm />} />
            <Route path="devices/:id" element={<DeviceDetail />} />
            <Route path="devices/:id/edit" element={<DeviceForm />} />
            <Route
              path="approvals"
              element={
                <ProtectedRoute requireAdmin>
                  <ApprovalList />
                </ProtectedRoute>
              }
            />
            <Route
              path="maintenance/devices"
              element={
                <ProtectedRoute requireMaintenance>
                  <MaintenanceDeviceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="maintenance/devices/:id/maintenance"
              element={
                <ProtectedRoute requireMaintenance>
                  <MaintenanceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="maintenance/my-submissions"
              element={
                <ProtectedRoute requireMaintenance>
                  <MaintenanceHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="maintenance/approvals"
              element={
                <ProtectedRoute requireAdmin>
                  <MaintenanceApprovalList />
                </ProtectedRoute>
              }
            />
            <Route
              path="data-management"
              element={
                <ProtectedRoute requireAdmin>
                  <DataManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <InnerApp />
    </QueryClientProvider>
  )
}

export default App
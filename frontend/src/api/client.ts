// API 客户端配置
import axios from 'axios'

const API_BASE_URL = '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  // 确保响应数据正确解码
  responseType: 'json',
  // 确保请求数据正确编码
  transformRequest: [(data, headers) => {
    if (headers && typeof headers === 'object') {
      headers['Content-Type'] = 'application/json; charset=utf-8'
    }
    return JSON.stringify(data)
  }],
})

// 请求拦截器 - 添加 JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理认证失败
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
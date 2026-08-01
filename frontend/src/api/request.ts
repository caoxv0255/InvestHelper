import axios, { type AxiosRequestConfig } from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

client.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // 这里只记录网络层/序列化层错误，业务错误由各页面捕获并展示
    // eslint-disable-next-line no-console
    console.warn('[api] response error:', error?.message ?? error)
    return Promise.reject(error)
  },
)

const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => client.get<T>(url, config).then((response) => response.data as T),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.post<T>(url, data, config).then((response) => response.data as T),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.put<T>(url, data, config).then((response) => response.data as T),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => client.delete<T>(url, config).then((response) => response.data as T),
}

export default api

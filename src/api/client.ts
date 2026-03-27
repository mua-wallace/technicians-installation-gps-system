import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL

  // In production (e.g. Vercel over HTTPS), never use an insecure absolute HTTP API URL
  // from env because browsers block mixed-content requests and surface generic network errors.
  if (import.meta.env.PROD && envUrl && /^http:\/\//i.test(envUrl)) {
    return '/api/v1'
  }

  const fallback = import.meta.env.DEV ? 'http://localhost:5400/api/v1/' : '/api/v1/'
  return String(envUrl || fallback).replace(/\/+$/, '')
}

const API_BASE_URL = getApiBaseUrl()

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken')
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('Missing refresh token')

        const resp = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken })
        const { accessToken } = resp.data as { accessToken: string }

        localStorage.setItem('accessToken', accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)


import { getIdToken } from '../auth/firebase.js'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export async function api(path, options = {}) {
  if (!baseUrl) throw new Error('尚未設定 VITE_API_BASE_URL')
  const token = await getIdToken()
  if (!token) throw new Error('請先登入')
  const headers = { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  const response = await fetch(baseUrl + path, { ...options, headers, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body })
  if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.error || `HTTP ${response.status}`) }
  if (response.status === 204) return null
  return options.download ? response.blob() : response.json()
}
export function apiConfigured() { return Boolean(baseUrl) }

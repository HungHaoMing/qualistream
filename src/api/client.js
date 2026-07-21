const API = '/api/v1'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(API + path, { ...options, headers })
  if (!response.ok) {
    let body = null
    try { body = await response.json() } catch { body = null }
    throw new ApiError(body?.detail || `請求失敗（HTTP ${response.status}）`, response.status, body)
  }
  const type = response.headers.get('content-type') || ''
  return type.includes('json') ? response.json() : response.text()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}


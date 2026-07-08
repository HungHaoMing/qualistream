// ═══════════════════════════════════════════════════
// QualiStream — GAS API Layer
// ═══════════════════════════════════════════════════

export async function gasGet(gasUrl, params) {
  if (!gasUrl) throw new Error('請先設定 GAS URL')
  const url = new URL(gasUrl)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export async function gasPost(gasUrl, body) {
  if (!gasUrl) throw new Error('請先設定 GAS URL')
  const res = await fetch(gasUrl, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

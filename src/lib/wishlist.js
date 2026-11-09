export const draftKey = 'merry-little-wishes:draft:v1'
export const ownerKey = 'merry-little-wishes:owner:v1'

export async function request(path, { method = 'GET', body, editToken } = {}) {
  let response
  try {
    response = await fetch(`/api/lists${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(editToken ? { Authorization: `Bearer ${editToken}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch { throw new Error('Could not reach the server. Your saved list is still here. Please try again.') }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not update your wishlist. Please try again.')
  return data
}

export function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback }
  catch { return fallback }
}

export function productUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function readDraft(legacyKey) {
  const saved = readSaved(draftKey, null)
  if (saved && typeof saved.name === 'string' && Array.isArray(saved.items)) return saved
  const legacy = readSaved(legacyKey, [])
  return { name: 'My wishlist', items: Array.isArray(legacy) ? legacy.filter(item => typeof item === 'string').map(name => ({ id: crypto.randomUUID(), name, url: '', image: '', price: '', notes: '', priority: 'idea' })) : [] }
}

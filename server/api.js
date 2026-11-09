import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { mongoStore } from './database.js'

const token = () => randomBytes(24).toString('hex')
const hash = value => createHash('sha256').update(value).digest('hex')
const validToken = value => /^[a-f0-9]{48}$/.test(value || '')
function fail(status, message) { throw Object.assign(new Error(message), { status }) }
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function safeUrl(value) {
  const input = text(value, 2048)
  if (!input) return ''
  try {
    const url = new URL(input)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error()
    return url.href
  } catch { fail(400, 'Use a complete http:// or https:// link.') }
}
function cleanItem(item) {
  const name = text(item.name, 160)
  if (!name) fail(400, 'Give your wish a name.')
  return { id: token(), name, url: safeUrl(item.url), image: safeUrl(item.image), price: text(item.price, 60), notes: text(item.notes, 1000), priority: item.priority === 'love' ? 'love' : 'idea', purchased: false }
}
async function body(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 32768) fail(413, 'This request is too large.')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString())
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error()
    return value
  } catch { fail(400, 'Invalid request.') }
}

export function createApi({ store = mongoStore } = {}) {
  // Serialize reads and writes so two visitors cannot overwrite each other's updates.
  let pending = Promise.resolve()
  return function api(req, res, next) {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (!pathname.startsWith('/api/')) return next?.()
    const handle = async () => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const send = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)) }
      try {
        // Reject cross-origin browser mutations; no CORS access is granted.
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) fail(403, 'Request origin is not allowed.')
        const parts = pathname.split('/').filter(Boolean)
        if (parts[1] !== 'lists') fail(404, 'Not found.')
        if (req.method === 'POST' && parts.length === 2) {
          const input = await body(req)
          if (input.items !== undefined && (!Array.isArray(input.items) || input.items.length > 200)) fail(400, 'Your list can hold up to 200 wishes.')
          const viewToken = token(), editToken = token()
          const record = { _id: hash(viewToken), editHash: hash(editToken), name: text(input.name, 80) || 'My wishlist', items: (input.items || []).map(cleanItem), version: 0, createdAt: new Date(), updatedAt: new Date() }
          await store.create(record)
          return send({ viewToken, editToken }, 201)
        }
        const viewToken = parts[2]
        if (!validToken(viewToken)) fail(404, 'This wishlist could not be found.')
        const record = await store.get(hash(viewToken))
        if (!record) fail(404, 'This wishlist could not be found.')
        const authorization = req.headers.authorization?.replace(/^Bearer /, '')
        const owner = validToken(authorization) && timingSafeEqual(Buffer.from(hash(authorization)), Buffer.from(record.editHash))
        const snapshot = () => ({ name: record.name, items: record.items.map(({ purchased, ...item }) => owner ? item : { ...item, purchased }) })
        const save = async () => {
          await store.save(record)
          send(snapshot())
        }
        if (req.method === 'GET' && parts.length === 3) {
          if (authorization && !owner) fail(403, 'Your editing link is invalid.')
          return send(snapshot())
        }
        if (req.method === 'PATCH' && parts.length === 5 && parts[3] === 'purchases') {
          if (owner) fail(403, 'Purchase markers are only available in the shared view.')
          const input = await body(req)
          const item = record.items.find(item => item.id === parts[4])
          if (!item) fail(404, 'This item is no longer on the list.')
          if (typeof input.purchased !== 'boolean') fail(400, 'Invalid purchase marker.')
          item.purchased = input.purchased
          return await save()
        }
        if (!owner) fail(403, 'You need the private editing link to update this list.')
        if (req.method === 'PATCH' && parts.length === 3) {
          const input = await body(req)
          record.name = text(input.name, 80)
          if (!record.name) fail(400, 'Give your list a name.')
          return await save()
        }
        if (req.method === 'POST' && parts.length === 4 && parts[3] === 'items') {
          if (record.items.length >= 200) fail(400, 'Your list can hold up to 200 wishes.')
          record.items.unshift(cleanItem(await body(req)))
          return await save()
        }
        if (parts.length === 5 && parts[3] === 'items') {
          const index = record.items.findIndex(item => item.id === parts[4])
          if (index === -1) fail(404, 'This item is no longer on the list.')
          if (req.method === 'PUT') {
            record.items[index] = { ...cleanItem(await body(req)), id: record.items[index].id, purchased: record.items[index].purchased }
            return await save()
          }
          if (req.method === 'DELETE') { record.items.splice(index, 1); return await save() }
        }
        fail(404, 'Not found.')
      } catch (error) { send({ error: error.status ? error.message : 'Could not save your list. Please try again.' }, error.status || 500) }
    }
    pending = pending.then(handle, handle)
  }
}

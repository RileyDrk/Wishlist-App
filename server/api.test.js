import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createApi } from './api.js'

test('wishlist API: sharing, edit authorization, validation, and private purchase markers', async t => {
  const records = new Map()
  const store = {
    async create(record) { records.set(record._id, structuredClone(record)) },
    async get(id) { return structuredClone(records.get(id)) },
    async save(record) { records.set(record._id, structuredClone(record)) },
  }
  const api = createApi({ store })
  const server = http.createServer((req, res) => api(req, res, () => res.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/lists`
  async function call(path = '', { method = 'GET', data, editToken, origin } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(editToken ? { Authorization: `Bearer ${editToken}` } : {}), ...(origin ? { Origin: origin } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
    return { status: response.status, data: await response.json() }
  }
  const created = await call('', { method: 'POST', data: { name: 'Her birthday wishes', items: [{ name: 'Cozy sweater', url: 'https://example.com/sweater', notes: 'Medium, green', priority: 'love', price: '$45 CAD' }] } })
  assert.equal(created.status, 201)
  const { viewToken, editToken } = created.data
  assert.notEqual(viewToken, editToken)
  const shared = await call(`/${viewToken}`)
  const item = shared.data.items[0]
  assert.equal(shared.data.name, 'Her birthday wishes')
  assert.equal(item.notes, 'Medium, green')
  assert.equal(shared.data.editHash, undefined)
  assert.equal(shared.data.editToken, undefined)
  assert.equal(shared.data._id, undefined)
  assert.equal((await call(`/${viewToken}/items`, { method: 'POST', data: { name: 'Unauthorized' } })).status, 403)
  assert.equal((await call(`/${viewToken}`, { editToken: 'a'.repeat(48) })).status, 403)
  assert.equal((await call(`/${viewToken}/purchases/${item.id}`, { method: 'PATCH', data: { purchased: true } })).data.items[0].purchased, true)
  assert.equal((await call(`/${viewToken}`, { editToken })).data.items[0].purchased, undefined)
  assert.equal((await call(`/${viewToken}/purchases/${item.id}`, { method: 'PATCH', editToken, data: { purchased: false } })).status, 403)
  const updated = await call(`/${viewToken}/items/${item.id}`, { method: 'PUT', editToken, data: { ...item, name: 'Updated sweater', purchased: false } })
  assert.equal(updated.data.items[0].name, 'Updated sweater')
  assert.equal(updated.data.items[0].purchased, undefined)
  assert.equal((await call(`/${viewToken}`)).data.items[0].purchased, true)
  assert.equal((await call(`/${viewToken}/items`, { method: 'POST', editToken, data: { name: 'Bad link', url: 'javascript:alert(1)' } })).status, 400)
  assert.equal((await call(`/${viewToken}/items`, { method: 'POST', editToken, data: { name: 'Bad link', url: 'https://user:secret@example.com' } })).status, 400)
  assert.equal((await call(`/${viewToken}`, { method: 'PATCH', editToken, data: { name: 'New list name' } })).data.name, 'New list name')
  assert.equal((await call(`/${viewToken}/items/${item.id}`, { method: 'DELETE', editToken })).data.items.length, 0)
  assert.equal((await call(`/${viewToken}/items/${item.id}`, { method: 'DELETE', editToken })).status, 404)
  assert.equal((await call('/not-a-token')).status, 404)
  assert.equal((await call('', { method: 'POST', data: {}, origin: 'https://another-site.example' })).status, 403)
})

test('database unavailable errors are shown without leaking connection details', async t => {
  const api = createApi({ store: { async create() { throw new Error('mongodb://private:secret@internal') } } })
  const server = http.createServer(api)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/lists`, { method: 'POST', body: '{}' })
  assert.equal(response.status, 500)
  assert.equal((await response.text()).includes('secret'), false)
})

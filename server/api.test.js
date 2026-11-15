import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApi } from './api.js'

test('wishlist API: sharing, edit authorization, validation, and private purchase markers', async t => {
  const records = new Map()
  const store = {
    async create(record) { records.set(record._id, structuredClone(record)) },
    async get(id) { return structuredClone(records.get(id)) },
    async save(record) { records.set(record._id, structuredClone(record)) },
  }
  const api = createApi({ store, allowLegacyCreate: true })
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
  const healthy = await fetch(base.replace('/lists', '/health'))
  assert.equal(healthy.status, 200)
  assert.deepEqual(await healthy.json(), { status: 'ok' })
  assert.equal(created.status, 201)
  const { viewToken, editToken } = created.data
  assert.notEqual(viewToken, editToken)
  const momsList = await call('', { method: 'POST', data: { name: 'Mom', items: [{ name: 'Book' }] } })
  assert.equal(momsList.status, 201)
  assert.notEqual(momsList.data.viewToken, viewToken)
  assert.equal((await call(`/${viewToken}`, { editToken: momsList.data.editToken })).status, 403)
  assert.equal((await call(`/${momsList.data.viewToken}`, { editToken })).status, 403)
  assert.equal((await call(`/${momsList.data.viewToken}`)).data.items[0].name, 'Book')
  assert.equal((await call('/')).status, 404)
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
  assert.equal((await call(`/${viewToken}`)).data.items[0].name, 'Updated sweater')
  assert.equal((await call(`/${momsList.data.viewToken}`)).data.items[0].name, 'Book')
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
  const api = createApi({ allowLegacyCreate: true, store: { async create() { throw new Error('mongodb://private:secret@internal') } } })
  const server = http.createServer(api)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/lists`, { method: 'POST', body: '{}' })
  assert.equal(response.status, 500)
  assert.equal((await response.text()).includes('secret'), false)
})

test('expanded wishes preserve text sizes and photos through create, edit, sharing, and server restart', async t => {
  const photoDirectory = await mkdtemp(path.join(tmpdir(), 'wishlist-photos-'))
  t.after(() => {
    assert.equal(path.dirname(photoDirectory), path.resolve(tmpdir()))
    assert.ok(path.basename(photoDirectory).startsWith('wishlist-photos-'))
    return rm(photoDirectory, { recursive: true, force: true })
  })
  const records = new Map()
  const store = {
    async create(record) { records.set(record._id, structuredClone(record)) },
    async get(id) { return structuredClone(records.get(id)) },
    async save(record) { records.set(record._id, structuredClone(record)) },
  }
  const servers = []
  t.after(async () => { for (const server of servers) await new Promise(resolve => server.close(resolve)) })
  async function start() {
    const server = http.createServer(createApi({ store, photoDirectory, allowLegacyCreate: true }))
    servers.push(server)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${server.address().port}`
  }
  let base = await start()
  async function call(route, method = 'GET', data, editToken) {
    const response = await fetch(`${base}/api/lists${route}`, {
      method,
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(editToken ? { Authorization: `Bearer ${editToken}` } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
    return { status: response.status, data: await response.json() }
  }
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  const wish = {
    name: 'Favorite jeans', store: 'Local boutique', price: '85', currency: 'CAD', quantity: '2',
    alternatives: 'Dark blue preferred; black is fine.', priority: 'top', notes: 'Relaxed fit',
    details: [{ label: 'Size', value: '00' }, { label: 'Inseam', value: '28' }, { label: 'Custom detail', value: 'Anything she wants' }],
    image: `data:image/png;base64,${png}`,
  }
  const created = await call('', 'POST', { name: 'Her wishes', items: [wish] })
  assert.equal(created.status, 201)
  const { viewToken, editToken } = created.data
  const route = `/${viewToken}`
  let result = await call(route, 'GET', undefined, editToken)
  let item = result.data.items[0]
  assert.equal(item.details[0].value, '00')
  assert.deepEqual(item.details, wish.details)
  for (const field of ['store', 'price', 'currency', 'alternatives', 'priority', 'notes']) assert.equal(item[field], wish[field])
  assert.equal(item.quantity, 2)
  assert.match(item.image, /^\/uploads\/[a-f0-9]{64}\.png$/)
  assert.equal((await readFile(path.join(photoDirectory, path.basename(item.image)))).toString('base64'), png)
  const photo = await fetch(`${base}${item.image}`)
  assert.equal(photo.status, 200)
  assert.equal(photo.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), Buffer.from(png, 'base64'))
  assert.equal((await call(`${route}/items`, 'POST', { ...wish, name: 'Second wish' })).status, 403)
  const markers = await call(`${route}/purchases/${item.id}`, 'PATCH', { purchased: true })
  assert.equal(markers.data.items[0].purchased, true)
  result = await call(`${route}/items/${item.id}`, 'PUT', { ...item, details: [{ label: 'Size', value: '28 × 30' }] }, editToken)
  assert.equal(result.data.items[0].details[0].value, '28 × 30')
  assert.equal(result.data.items[0].image, item.image)
  assert.equal(result.data.items[0].purchased, undefined)
  assert.equal((await call(route)).data.items[0].purchased, true)
  for (const invalid of [
    { quantity: 1.5 }, { quantity: -1 }, { quantity: 1000 },
    { details: [{ label: 'Size', value: '' }] }, { details: Array(31).fill({ label: 'Size', value: 'M' }) },
    { image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
    { image: 'data:image/png;base64,aGVsbG8=' }, { image: '/uploads/../../.env' },
  ]) {
    assert.equal((await call(`${route}/items`, 'POST', { ...wish, ...invalid }, editToken)).status, 400)
  }
  assert.equal((await call(`${route}/items`, 'POST', { name: 'Name only' }, editToken)).status, 200)
  base = await start()
  assert.equal((await fetch(`${base}${item.image}`)).status, 200)
  const reloaded = await call(route, 'GET', undefined, editToken)
  item = reloaded.data.items.find(saved => saved.name === wish.name)
  assert.equal(item.details[0].value, '28 × 30')
  assert.equal(item.store, wish.store)
  assert.equal(item.quantity, 2)
})

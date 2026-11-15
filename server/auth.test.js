import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { createApi } from './api.js'
import { createLocalStore } from './localStore.js'

test('accounts own exactly one isolated list, share a stable link, and persist securely across restarts', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'wishlist-accounts-'))
  const filename = path.join(directory, 'preview.json')
  const servers = []
  t.after(async () => {
    for (const server of servers) await new Promise(resolve => server.close(resolve))
    assert.equal(path.dirname(directory), path.resolve(tmpdir()))
    assert.ok(path.basename(directory).startsWith('wishlist-accounts-'))
    await rm(directory, { recursive: true, force: true })
  })
  async function start() {
    const local = createLocalStore(filename)
    const server = http.createServer(createApi({ store: local.lists, accountStore: local.accounts, preview: true, photoDirectory: path.join(directory, 'uploads') }))
    servers.push(server)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${server.address().port}`
  }
  let base = await start()
  async function call(route, { method = 'GET', data, cookie, origin } = {}) {
    const response = await fetch(`${base}/api/${route}`, {
      method,
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') }
  }
  const password = 'a-unique-password-for-tests'
  assert.equal((await call('auth/session')).data.user, null)
  assert.equal((await call('auth/register', { method: 'POST', data: { name: 'Mom', username: 'mom', password: 'short' } })).status, 400)
  const first = await call('auth/register', { method: 'POST', data: { name: 'Alex', username: 'Alex', password, items: [{ name: 'Jeans', details: [{ label: 'Size', value: '00' }] }] } })
  assert.equal(first.status, 200)
  assert.equal(first.data.user.username, 'alex')
  assert.equal(first.data.user.editToken, undefined)
  assert.equal(first.data.user.passwordHash, undefined)
  assert.match(first.cookie, /HttpOnly/)
  assert.match(first.cookie, /SameSite=Lax/)
  const firstCookie = first.cookie.split(';')[0]
  const firstToken = first.data.user.viewToken
  assert.equal((await call('auth/session', { cookie: firstCookie })).data.user.username, 'alex')
  const second = await call('auth/register', { method: 'POST', data: { name: 'Mom', username: 'mom', password } })
  const secondCookie = second.cookie.split(';')[0]
  const secondToken = second.data.user.viewToken
  assert.notEqual(firstToken, secondToken)
  const myList = await call(`lists/${firstToken}`, { cookie: firstCookie })
  assert.equal(myList.data.items[0].details[0].value, '00')
  assert.equal((await call('lists', { method: 'POST', data: {}, cookie: firstCookie })).status, 403)
  assert.equal((await call('lists', { method: 'POST', data: {} })).status, 403)
  assert.equal((await call('lists/')).status, 404)
  assert.equal((await call('auth/register', { method: 'POST', cookie: firstCookie, data: { name: 'Extra', username: 'extra', password } })).status, 409)
  assert.equal((await call(`lists/${firstToken}/items`, { method: 'POST', cookie: secondCookie, data: { name: 'Wrong owner' } })).status, 403)
  assert.equal((await call(`lists/${secondToken}/items`, { method: 'POST', cookie: firstCookie, data: { name: 'Wrong owner' } })).status, 403)
  assert.equal((await call(`lists/${firstToken}/items`, { method: 'POST', data: { name: 'Guest edit' } })).status, 403)
  assert.equal((await call(`lists/${firstToken}/items`, { method: 'POST', cookie: firstCookie, origin: 'https://another-site.example', data: { name: 'Bad origin' } })).status, 403)
  const added = await call(`lists/${firstToken}/items`, { method: 'POST', cookie: firstCookie, data: { name: 'Sweater' } })
  assert.equal(added.status, 200)
  const viewing = await call(`lists/${firstToken}`)
  assert.equal(viewing.data.items[0].name, 'Sweater')
  assert.equal((await call(`lists/${secondToken}`, { cookie: secondCookie })).data.items.length, 0)
  const itemId = viewing.data.items[0].id
  assert.equal((await call(`lists/${firstToken}/purchases/${itemId}`, { method: 'PATCH', data: { purchased: true } })).status, 200)
  assert.equal((await call(`lists/${firstToken}`, { cookie: firstCookie })).data.items[0].purchased, undefined)
  assert.equal((await call(`lists/${firstToken}/purchases/${itemId}`, { method: 'PATCH', cookie: firstCookie, data: { purchased: false } })).status, 403)
  assert.equal((await call('auth/register', { method: 'POST', data: { name: 'Other', username: 'ALEX', password } })).status, 409)
  assert.equal((await call('auth/login', { method: 'POST', data: { username: 'alex', password: 'incorrect-password' } })).status, 401)
  const stored = JSON.parse(await readFile(filename, 'utf8'))
  assert.equal(JSON.stringify(stored).includes(password), false)
  assert.equal(stored.sessions[firstCookie.split('=')[1]], undefined)
  base = await start()
  assert.equal((await call('auth/session', { cookie: firstCookie })).data.user.viewToken, firstToken)
  const login = await call('auth/login', { method: 'POST', data: { username: 'ALEX', password } })
  assert.equal(login.status, 200)
  assert.equal(login.data.user.viewToken, firstToken)
  assert.equal((await call(`lists/${firstToken}`, { cookie: login.cookie.split(';')[0] })).data.items.length, 2)
  await call('auth/logout', { method: 'POST', data: {}, cookie: firstCookie })
  assert.equal((await call('auth/session', { cookie: firstCookie })).data.user, null)
  const expired = JSON.parse(await readFile(filename, 'utf8'))
  for (const session of Object.values(expired.sessions)) session.expiresAt = new Date(0).toISOString()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(filename, JSON.stringify(expired))
  base = await start()
  assert.equal((await call('auth/session', { cookie: secondCookie })).data.user, null)
})

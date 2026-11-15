import { randomBytes, createHash, scrypt as deriveKey, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mongoAccounts } from './database.js'

const scrypt = promisify(deriveKey)
const token = () => randomBytes(24).toString('hex')
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const lifetime = 30 * 24 * 60 * 60
const cookieName = 'wishlist_session'
const sessionToken = req => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
const passwordKey = (password, salt) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })

export function createAuth({ accounts = mongoAccounts, lists, cleanItem, readBody, preview = false }) {
  const attempts = new Map()
  function rateLimit(req) {
    const now = Date.now(), address = req.socket.remoteAddress
    for (const [key, entry] of attempts) if (entry.reset <= now) attempts.delete(key)
    const entry = attempts.get(address) || { count: 0, reset: now + 15 * 60 * 1000 }
    if (attempts.size >= 10000 && !attempts.has(address)) fail(429, 'Please try again later.')
    entry.count += 1
    attempts.set(address, entry)
    if (entry.count > 20) fail(429, 'Too many login attempts. Try again in 15 minutes.')
  }
  function setCookie(res, value, maxAge = lifetime) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
  }
  async function user(req) {
    const value = sessionToken(req)
    if (!/^[a-f0-9]{48}$/.test(value || '')) return null
    const session = await accounts.getSession(hash(value))
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null
    return await accounts.getUser(session.username) || null
  }
  async function signIn(res, current) {
    const value = token()
    await accounts.createSession({ _id: hash(value), username: current._id, expiresAt: new Date(Date.now() + lifetime * 1000) })
    setCookie(res, value)
  }
  const snapshot = current => ({ user: current ? { username: current._id, name: current.name, viewToken: current.viewToken } : null, preview })
  async function handle(req, res, pathname) {
    if (req.method === 'GET' && pathname === '/api/auth/session') return snapshot(await user(req))
    if (req.method !== 'POST') fail(404, 'Not found.')
    if (pathname === '/api/auth/logout') {
      const value = sessionToken(req)
      if (/^[a-f0-9]{48}$/.test(value || '')) await accounts.deleteSession(hash(value))
      setCookie(res, '', 0)
      return { user: null, preview }
    }
    if (!['/api/auth/register', '/api/auth/login'].includes(pathname)) fail(404, 'Not found.')
    rateLimit(req)
    const input = await readBody(req)
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : ''
    const password = input.password
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) fail(400, 'Use a username with 3–32 letters, numbers, dots, underscores, or hyphens.')
    if (typeof password !== 'string' || password.length > 128 || password.length < 10) fail(400, 'Use a password between 10 and 128 characters.')
    let current
    if (pathname === '/api/auth/register') {
      if (await user(req)) fail(409, 'You already have an account and a wishlist. Sign out to create another account.')
      const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : ''
      if (!name) fail(400, 'Enter your name.')
      if (input.items !== undefined && (!Array.isArray(input.items) || input.items.length > 200)) fail(400, 'Your list can hold up to 200 wishes.')
      if (await accounts.getUser(username)) fail(409, 'That username is already taken.')
      const salt = randomBytes(16).toString('hex'), viewToken = token()
      current = { _id: username, name, salt, passwordHash: (await passwordKey(password, salt)).toString('hex'), viewToken, createdAt: new Date() }
      const items = []
      for (const item of input.items || []) items.push(await cleanItem(item))
      try { await accounts.createUser(current) }
      catch (error) { if (error.code === 11000) fail(409, 'That username is already taken.'); throw error }
      try {
        await lists.create({ _id: hash(viewToken), editHash: hash(token()), name: `${name}’s wishlist`, items, version: 0, createdAt: new Date(), updatedAt: new Date() })
      } catch (error) { await accounts.deleteUser(username); throw error }
    } else {
      current = await accounts.getUser(username)
      // Derive a key even for unknown usernames to avoid a fast username probe.
      const key = await passwordKey(password, current?.salt || 'unknown-user-salt')
      const expected = current ? Buffer.from(current.passwordHash, 'hex') : Buffer.alloc(64)
      if (!current || !timingSafeEqual(key, expected)) fail(401, 'Username or password is incorrect.')
    }
    await signIn(res, current)
    return snapshot(current)
  }
  return { user, handle }
}

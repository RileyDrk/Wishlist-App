// Development preview only. Production uses MongoDB and never falls back here.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

export function createLocalStore(filename = path.resolve('.data/preview.json')) {
  let state
  async function data() {
    if (!state) state = readFile(filename, 'utf8').then(JSON.parse).catch(error => {
      if (error.code !== 'ENOENT') throw error
      return { lists: {}, users: {}, sessions: {} }
    })
    return state
  }
  async function persist() {
    const value = await data()
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(`${filename}.tmp`, JSON.stringify(value), { mode: 0o600 })
    await rename(`${filename}.tmp`, filename)
  }
  const copy = value => value === undefined ? undefined : structuredClone(value)
  async function put(group, key, value) {
    const current = await data()
    current[group][key] = copy(value)
    await persist()
  }
  async function remove(group, key) { delete (await data())[group][key]; await persist() }
  return {
    lists: {
      async create(record) {
        if ((await data()).lists[record._id]) throw Object.assign(new Error('List already exists.'), { code: 11000 })
        await put('lists', record._id, record)
      },
      async get(id) { return copy((await data()).lists[id]) },
      async save(record) {
        const previous = (await data()).lists[record._id]
        if (!previous || previous.version !== record.version) throw Object.assign(new Error('This list changed. Refresh and try again.'), { status: 409 })
        await put('lists', record._id, { ...record, version: record.version + 1, updatedAt: new Date() })
      },
    },
    accounts: {
      async getUser(username) {
        const users = (await data()).users
        return Object.hasOwn(users, username) ? copy(users[username]) : undefined
      },
      async createUser(user) {
        if (Object.hasOwn((await data()).users, user._id)) throw Object.assign(new Error('Username is taken.'), { code: 11000 })
        await put('users', user._id, user)
      },
      async deleteUser(username) { await remove('users', username) },
      async getSession(id) { return copy((await data()).sessions[id]) },
      async createSession(session) {
        const sessions = (await data()).sessions
        for (const [id, value] of Object.entries(sessions)) if (new Date(value.expiresAt) <= new Date()) delete sessions[id]
        await put('sessions', session._id, session)
      },
      async deleteSession(id) { await remove('sessions', id) },
    },
  }
}

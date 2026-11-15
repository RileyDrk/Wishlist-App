import './env.js'
import { MongoClient } from 'mongodb'

let connection

export async function getCollection(name = 'wishlists') {
  if (!process.env.MONGODB_URI) {
    throw Object.assign(new Error('MongoDB is not configured yet. Add MONGODB_URI to the server .env file, then restart the app.'), { status: 503 })
  }
  if (!connection) {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    connection = client.connect().then(() => client.db(process.env.MONGODB_DB || 'merry_little_wishes')).catch(async () => {
      connection = undefined
      await client.close().catch(() => {})
      throw Object.assign(new Error('Could not connect to MongoDB. Check the server connection and try again.'), { status: 503 })
    })
  }
  return (await connection).collection(name)
}

let sessionIndex
export const mongoAccounts = {
  async getUser(username) { return (await getCollection('users')).findOne({ _id: username }) },
  async createUser(user) { await (await getCollection('users')).insertOne(user) },
  async deleteUser(username) { await (await getCollection('users')).deleteOne({ _id: username }) },
  async getSession(id) { return (await getCollection('sessions')).findOne({ _id: id }) },
  async createSession(session) {
    const collection = await getCollection('sessions')
    if (!sessionIndex) sessionIndex = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(error => { sessionIndex = undefined; throw error })
    await sessionIndex
    await collection.insertOne(session)
  },
  async deleteSession(id) { await (await getCollection('sessions')).deleteOne({ _id: id }) },
}

export const mongoStore = {
  async create(record) { await (await getCollection()).insertOne(record) },
  async get(id) { return (await getCollection()).findOne({ _id: id }) },
  async save(record) {
    const previousVersion = record.version
    const result = await (await getCollection()).replaceOne(
      { _id: record._id, version: previousVersion },
      { ...record, version: previousVersion + 1, updatedAt: new Date() },
    )
    if (!result.matchedCount) throw Object.assign(new Error('This list just changed. Refresh it and try again.'), { status: 409 })
  },
}

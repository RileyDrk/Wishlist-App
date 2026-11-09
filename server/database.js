import './env.js'
import { MongoClient } from 'mongodb'

let connection

export async function getCollection() {
  if (!process.env.MONGODB_URI) {
    throw Object.assign(new Error('MongoDB is not configured yet. Add MONGODB_URI to the server .env file, then restart the app.'), { status: 503 })
  }
  if (!connection) {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    connection = client.connect().then(() => client.db(process.env.MONGODB_DB || 'merry_little_wishes').collection('wishlists')).catch(async () => {
      connection = undefined
      await client.close().catch(() => {})
      throw Object.assign(new Error('Could not connect to MongoDB. Check the server connection and try again.'), { status: 503 })
    })
  }
  return connection
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

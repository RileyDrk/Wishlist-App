import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const photoDirectory = path.resolve(process.env.UPLOADS_DIR || '.data/uploads')
const photoPath = /^\/uploads\/([a-f0-9]{64})\.(jpg|png|webp)$/
const fail = message => { throw Object.assign(new Error(message), { status: 400 }) }

export async function storePhoto(value, directory = photoDirectory) {
  if (!value) return ''
  if (typeof value !== 'string') fail('Choose a valid photo.')
  if (photoPath.test(value)) return value
  if (!value.startsWith('data:')) {
    try {
      const url = new URL(value)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || value.length > 2048) throw new Error()
      return url.href
    } catch { fail('Use a complete http:// or https:// photo link.') }
  }
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) fail('Choose a JPG, PNG, or WebP photo.')
  if (match[2].length > Math.ceil(512 * 1024 / 3) * 4) fail('The prepared photo must be smaller than 512 KB.')
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 512 * 1024 || bytes.toString('base64') !== match[2]) fail('The photo is invalid or too large.')
  const valid = match[1] === 'jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!valid) fail('This file does not contain a supported photo.')
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
  const filename = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, filename), bytes)
  return `/uploads/${filename}`
}

export async function servePhoto(req, res, directory = photoDirectory) {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (!pathname.startsWith('/uploads/')) return false
  const match = pathname.match(photoPath)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!match) { res.writeHead(404).end('Not found'); return true }
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); res.writeHead(405).end(); return true }
  try {
    const bytes = await readFile(path.join(directory, `${match[1]}.${match[2]}`))
    res.setHeader('Content-Type', `image/${match[2] === 'jpg' ? 'jpeg' : match[2]}`)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Length', bytes.length)
    res.end(req.method === 'HEAD' ? undefined : bytes)
  } catch { res.writeHead(404).end('Not found') }
  return true
}

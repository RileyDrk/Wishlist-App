export const MAX_PHOTO_BYTES = 512 * 1024

export function photoUrl(value) {
  if (typeof value !== 'string') return ''
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length < MAX_PHOTO_BYTES * 1.4) return value
  if (/^\/uploads\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(value)) return value
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo. Convert HEIC photos to JPG first.')
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.')
  const image = await createImageBitmap(file).catch(() => { throw new Error('This photo could not be opened. Try another image.') })
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.7, 0.5, 0.3]) {
      const data = canvas.toDataURL('image/jpeg', quality)
      if ((data.length - data.indexOf(',') - 1) * 0.75 <= MAX_PHOTO_BYTES) return data
    }
    throw new Error('This image is too detailed to save. Try cropping it or choosing a smaller photo.')
  } finally { image.close() }
}

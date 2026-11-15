import { draftKey, readDraft } from './wishlist.js'

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wishlist-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Could not open browser storage. Allow site storage to save your draft.'))
  })
}

export async function loadDraft(legacyKey) {
  const db = await database()
  try {
    const saved = await new Promise((resolve, reject) => {
      const request = db.transaction('drafts').objectStore('drafts').get(draftKey)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return saved || readDraft(legacyKey)
  } finally { db.close() }
}

export async function saveDraft(list) {
  const db = await database()
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite')
      transaction.objectStore('drafts').put(list, draftKey)
      transaction.oncomplete = resolve
      transaction.onabort = () => reject(transaction.error || new Error('Your draft could not be saved.'))
      transaction.onerror = () => reject(transaction.error)
    })
    // Retire the old draft only after the new storage commits successfully.
    try { localStorage.removeItem(draftKey) } catch { /* IndexedDB remains authoritative. */ }
  } finally { db.close() }
}

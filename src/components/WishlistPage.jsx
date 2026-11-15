import { useEffect, useRef, useState } from 'react'
import { holiday } from '../config/holiday.js'
import { ownerKey, readSaved, request, productUrl, newItemId } from '../lib/wishlist.js'
import ItemForm from './ItemForm.jsx'
import { photoUrl } from '../lib/photos.js'
import { loadDraft, saveDraft } from '../lib/draftStorage.js'
import { priorities, wishCurrency } from '../config/wishFields.js'
import Icon from './Icon.jsx'
import { useAccount } from '../lib/accounts.jsx'

function ItemCard({ item, shared, onEdit, onRemove, onPurchase, busy }) {
  const [brokenImage, setBrokenImage] = useState(false)
  useEffect(() => setBrokenImage(false), [item.image])
  const url = productUrl(item.url), image = photoUrl(item.image)
  return <article className={`wishlist-card ${shared && item.purchased ? 'is-purchased' : ''}`}>
    <div className="item-picture">{image && !brokenImage ? <img src={image} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImage(true)} /> : <Icon name="gift" className="gift-placeholder" />}
      {['love', 'top'].includes(item.priority) && <span className="priority-badge"><Icon name={item.priority === 'top' ? 'star' : 'heart'} />{priorities.find(priority => priority.value === item.priority)?.label || 'Would love'}</span>}
      {shared && item.purchased && <span className="purchased-badge"><Icon name="check" /> Purchased</span>}
    </div>
    <div className="item-details"><div className="item-title-row"><h3>{item.name}</h3>{item.price && <span className="item-price">{item.price}{/\bCAD\b|C\$/i.test(item.price) ? '' : ` ${wishCurrency}`}</span>}</div>
      {(item.store || url) && <p className="store-name">{item.store || new URL(url).hostname.replace(/^www\./, '')}</p>}
      {item.details?.length > 0 && <dl className="wish-detail-list">{item.details.map((detail, index) => <div key={index}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>}
      {item.quantity && <p className="wish-quantity">Quantity: {item.quantity}</p>}
      {item.alternatives && <div className="wish-alternatives"><h4>Alternatives & preferences</h4><p>{item.alternatives}</p></div>}
      {item.notes && <p className="item-notes">{item.notes}</p>}
      <div className="item-actions">{url && <a href={url} target="_blank" rel="noopener noreferrer" className="product-link">View item <Icon name="external" /></a>}
      {!shared && <div><button aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)} disabled={busy}>Edit</button><button aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)} disabled={busy}>Remove</button></div>}</div>
      {shared && <button className={`purchase-button ${item.purchased ? 'marked' : ''}`} onClick={() => onPurchase(item)} disabled={busy}>{item.purchased ? 'Purchased · Undo' : 'Mark as purchased'}</button>}
    </div>
  </article>
}

export default function WishlistPage({ route, account }) {
  const { preview } = useAccount()
  const shared = route.startsWith('/shared/')
  const recovery = route.match(/^\/edit\/([a-f0-9]{48})\/([a-f0-9]{48})$/)
  const [credentials, setCredentials] = useState(() => recovery ? { viewToken: recovery[1], editToken: recovery[2] } : readSaved(ownerKey, null))
  const viewToken = shared ? route.split('/')[2] : recovery ? recovery[1] : account?.viewToken || credentials?.viewToken
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [filter, setFilter] = useState('all')
  const local = !shared && !credentials && !account
  const editToken = account && !recovery ? undefined : credentials?.editToken

  async function load({ quiet = false, signal } = {}) {
    if (!viewToken) return
    if (!quiet) { setLoading(true); setError('') }
    try {
      const snapshot = await request(`/${viewToken}`, { editToken: shared ? undefined : editToken, signal })
      if (!signal?.aborted) { setList(snapshot); setError('') }
    }
    catch (error) { if (!signal?.aborted) setError(error.message) }
    finally { if (!quiet && !signal?.aborted) setLoading(false) }
  }
  useEffect(() => {
    if (viewToken) {
      const controller = new AbortController()
      load({ signal: controller.signal })
      return () => controller.abort()
    }
    if (shared) { setError('This wishlist link is invalid.'); setLoading(false); return }
    let active = true
    setLoading(true)
    loadDraft(holiday.wishlist.storageKey)
      .then(draft => { if (active) setList(draft) })
      .catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [viewToken, shared])
  useEffect(() => {
    if (!recovery) return
    try { localStorage.setItem(ownerKey, JSON.stringify(credentials)) }
    catch { setNotice('Bookmark your private editing link so you can return to your list.') }
    window.history.replaceState(null, '', `${window.location.pathname}#/wishlist`)
  }, [])
  useEffect(() => {
    if (!viewToken || busy || editor || deleting || renaming) return
    const controller = new AbortController()
    let pending = false
    const refresh = async () => {
      if (document.visibilityState === 'hidden' || pending) return
      pending = true
      try { await load({ quiet: true, signal: controller.signal }) }
      finally { pending = false }
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = shared ? window.setInterval(refresh, 10000) : undefined
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [viewToken, shared, busy, editor, deleting, renaming])

  async function saveLocal(next) {
    // Do not clear the form or report success if browser storage fails.
    await saveDraft(next)
    setList(next)
  }
  async function perform(action) {
    setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (error) { setError(error.name === 'QuotaExceededError' ? 'Browser storage is full. Your change was not saved.' : error.message) }
    finally { setBusy(false) }
  }
  function saveItem(values) {
    return perform(async () => {
      if (!values.name.trim()) throw new Error('Give your wish a name.')
      if ((values.url && !productUrl(values.url)) || (values.image && !photoUrl(values.image))) throw new Error('Use a valid uploaded photo and complete http:// or https:// links.')
      if (local) {
        if (!editor.id && list.items.length >= 200) throw new Error('Your list can hold up to 200 wishes.')
        const item = { ...values, name: values.name.trim(), id: editor.id || newItemId() }
        await saveLocal({ ...list, items: editor.id ? list.items.map(old => old.id === item.id ? item : old) : [item, ...list.items] })
      } else setList(await request(`/${viewToken}/items${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PUT' : 'POST', body: values, editToken }))
      setEditor(null); setNotice('Wish saved!')
    })
  }
  function removeItem() { return perform(async () => {
    if (local) await saveLocal({ ...list, items: list.items.filter(item => item.id !== deleting.id) })
    else setList(await request(`/${viewToken}/items/${deleting.id}`, { method: 'DELETE', editToken }))
    setDeleting(null); setNotice('Wish removed.')
  }) }
  function rename(event) { event.preventDefault(); return perform(async () => {
    if (!name.trim()) throw new Error('Give your list a name.')
    if (local) await saveLocal({ ...list, name: name.trim() })
    else setList(await request(`/${viewToken}`, { method: 'PATCH', body: { name }, editToken }))
    setRenaming(false)
  }) }
  function shareList() { setSharing(true); setError('') }
  function enableSharing() { return perform(async () => {
    // Save recovery details before publishing, so a storage failure cannot lose access.
    await saveDraft(list)
    const result = await request('', { method: 'POST', body: list })
    setCredentials(result)
    try { localStorage.setItem(ownerKey, JSON.stringify(result)) }
    catch { setNotice('Keep your private editing link below. This browser could not remember it.') }
  }) }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setNotice('Link copied.') }
    catch { setNotice('Select and copy the link below.') }
  }
  const base = `${window.location.origin}${window.location.pathname}`
  const shareUrl = viewToken ? `${base}#/shared/${viewToken}` : ''
  const editUrl = !account && credentials ? `${base}#/edit/${credentials.viewToken}/${credentials.editToken}` : ''
  const items = list?.items.filter(item => filter !== 'love' || ['love', 'top'].includes(item.priority)) || []

  return <main className="wishlist-page">
    <div className="list-heading"><div><h1>{list?.name || 'My wishlist'}</h1><p>{shared ? 'Pick something they’ll love.' : 'Your favorites, all in one place.'}</p></div>
      {!shared && list && <div className="list-toolbar"><button className="secondary-button" onClick={shareList} disabled={busy}><Icon name="share" />Share list</button><button className="primary-button" onClick={() => setEditor({})} disabled={busy}><Icon name="plus" />Add a wish</button></div>}
    </div>
    {local && <div className="list-info"><Icon name="check" /><p>Saved on this device.</p></div>}
    {shared && <div className="list-info"><Icon name="gift" /><p>Anyone with this link can mark purchases. The owner won’t see the markers.</p><button onClick={load} disabled={loading || busy}>Refresh</button></div>}
    {!local && !shared && list && <div className="list-info"><Icon name="check" /><p>{preview ? 'Saved in this preview.' : 'Saved online.'}</p><button onClick={load} disabled={loading || busy}>Refresh</button></div>}
    {error && <div className="list-error" role="alert">{error}{viewToken && <button onClick={load} disabled={loading}>Try refreshing</button>}</div>}
    {notice && <p className="list-notice" role="status">{notice}</p>}
    {sharing && <section className="share-panel" aria-label="Share your wishlist"><div className="panel-title"><h2>Share your list</h2><button className="icon-button" onClick={() => setSharing(false)} aria-label="Close sharing options"><Icon name="close" /></button></div>
      {local ? <><p>Your list is saved on this device. Online sharing needs to be set up before you can send a link.</p><button className="primary-button" onClick={enableSharing} disabled={busy}>{busy ? 'Saving…' : 'Save online & create link'}</button></> : <>
        <label htmlFor="share-link">Share this with your gift-givers</label><div className="copy-row"><input id="share-link" value={shareUrl} readOnly onFocus={event => event.target.select()} /><button className="secondary-button" onClick={() => copy(shareUrl)}>Copy link</button></div>
        {editUrl && <details><summary>Your private editing link</summary><p>Keep this for yourself. Anyone with this link can change your list. Bookmark it to edit from another device.</p><div className="copy-row"><input aria-label="Private editing link" value={editUrl} readOnly onFocus={event => event.target.select()} /><button className="secondary-button" onClick={() => copy(editUrl)}>Copy</button></div></details>}
        <p className="fine-print">This link stays the same when you edit your wishes. Anyone with it can view your list and mark purchases.</p>
        {['localhost', '127.0.0.1'].includes(window.location.hostname) && <p className="fine-print">This address is local to this computer. Deploy the app before sending this link to someone on another device.</p>}
      </>}
    </section>}
    {loading && !list ? <div className="list-empty" role="status">Loading your wishes…</div> : list && <>
      <div className="list-controls"><div className="filter-tabs" aria-label="Filter wishes"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All wishes <span>{list.items.length}</span></button><button aria-pressed={filter === 'love'} onClick={() => setFilter('love')}><Icon name="heart" />Favorites <span>{list.items.filter(item => ['love', 'top'].includes(item.priority)).length}</span></button></div>{!shared && <button className="rename-button" onClick={() => { setName(list.name); setRenaming(!renaming) }} disabled={busy}>Rename</button>}</div>
      {renaming && <form onSubmit={rename} className="rename-form"><label htmlFor="list-name">List name</label><input autoFocus id="list-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required /><button className="secondary-button" disabled={busy}>Save name</button><button type="button" onClick={() => setRenaming(false)}>Cancel</button></form>}
      {items.length ? <div className="wishlist-grid">{items.map(item => <ItemCard key={item.id} item={item} shared={shared} onEdit={setEditor} onRemove={setDeleting} busy={busy} onPurchase={item => perform(async () => setList(await request(`/${viewToken}/purchases/${item.id}`, { method: 'PATCH', body: { purchased: !item.purchased } })))} />)}</div> : <div className="list-empty"><Icon name={filter === 'love' ? 'heart' : 'gift'} /><h2>{filter === 'love' ? 'Your favorites go here' : 'What’s on your wish list?'}</h2><p>{filter === 'love' ? 'Choose “Would love” or “Top wish” when adding a wish.' : shared ? 'No wishes yet. Check back soon.' : 'Found something you love? Save it here.'}</p>{!shared && <button className="primary-button" onClick={() => setEditor({})}><Icon name="plus" />Add a wish</button>}</div>}
    </>}
    {editor && <ItemForm item={editor.id ? editor : null} onSave={saveItem} onClose={() => setEditor(null)} busy={busy} error={error} />}
    {deleting && <DeleteDialog item={deleting} busy={busy} error={error} onClose={() => setDeleting(null)} onDelete={removeItem} />}
  </main>
}

function DeleteDialog({ item, busy, error, onClose, onDelete }) {
  const dialog = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  return <dialog ref={dialog} className="item-dialog delete-dialog" onCancel={event => { if (busy) event.preventDefault(); else onClose() }} onClose={onClose}><h2>Remove this wish?</h2><p>“{item.name}” will be removed from your list.</p>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Keep it</button><button className="primary-button" onClick={onDelete} disabled={busy}>{busy ? 'Removing…' : 'Remove wish'}</button></div></dialog>
}

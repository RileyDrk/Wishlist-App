import { useEffect, useRef, useState } from 'react'
import { holiday } from '../config/holiday.js'
import { draftKey, ownerKey, readDraft, readSaved, request, productUrl } from '../lib/wishlist.js'

const emptyItem = { name: '', url: '', image: '', price: '', notes: '', priority: 'idea' }

function ItemForm({ item, onSave, onClose, busy, error }) {
  const [values, setValues] = useState(item || emptyItem)
  const dialog = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  function change(event) { setValues({ ...values, [event.target.name]: event.target.value }) }
  return <dialog ref={dialog} className="item-dialog" onCancel={event => { if (busy) event.preventDefault(); else onClose() }} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onSave(values) }}>
      <div className="dialog-heading"><div><p className="eyebrow">A little something lovely</p><h2>{item ? 'Edit your wish' : 'Add a little wish'}</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close item form">×</button></div>
      <label htmlFor="item-name">Item name <span>*</span></label><input autoFocus id="item-name" name="name" value={values.name} onChange={change} maxLength={160} required placeholder="Something you’d love" />
      <label htmlFor="item-url">Product link</label><input id="item-url" name="url" type="url" pattern="https?://.*" title="Use an http:// or https:// link" value={values.url} onChange={change} maxLength={2048} placeholder="https://your-favorite-store.com/item" />
      <label htmlFor="item-notes">Description <small>optional</small></label>
      <textarea id="item-notes" name="notes" value={values.notes} onChange={change} maxLength={1000} rows={3} aria-describedby="item-description-help" placeholder={'Size: Medium\nColor: Forest green\nAny other details that would help them pick the right one…'} />
      <p id="item-description-help" className="description-help">Add a size, color, preferred style, or anything else your gift-giver should know.</p>
      <div className="form-columns"><div><label htmlFor="item-price">Price <small>optional</small></label><input id="item-price" name="price" value={values.price} onChange={change} maxLength={60} placeholder="e.g. $45 CAD" /></div><div><label htmlFor="item-priority">How much do you love it?</label><select id="item-priority" name="priority" value={values.priority} onChange={change}><option value="idea">Just an idea</option><option value="love">Love this</option></select></div></div>
      <label htmlFor="item-image">Photo link <small>optional</small></label><input id="item-image" name="image" type="url" pattern="https?://.*" value={values.image} onChange={change} maxLength={2048} placeholder="https://…/photo.jpg" />
      {error && <p className="list-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Add to my list'} <span aria-hidden="true">↗</span></button></div>
    </form>
  </dialog>
}

function ItemCard({ item, shared, onEdit, onRemove, onPurchase, busy }) {
  const [brokenImage, setBrokenImage] = useState(false)
  useEffect(() => setBrokenImage(false), [item.image])
  const url = productUrl(item.url), image = productUrl(item.image)
  return <article className={`wishlist-card ${shared && item.purchased ? 'is-purchased' : ''}`}>
    <div className="item-picture">{image && !brokenImage ? <img src={image} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImage(true)} /> : <span className="gift-placeholder" aria-hidden="true">♧</span>}
      {item.priority === 'love' && <span className="priority-badge">♡ Love this</span>}
      {shared && item.purchased && <span className="purchased-badge">✓ Purchased</span>}
    </div>
    <div className="item-details"><div className="item-title-row"><h3>{item.name}</h3>{item.price && <span className="item-price">{item.price}</span>}</div>
      {url && <p className="store-name">{new URL(url).hostname.replace(/^www\./, '')}</p>}
      {item.notes && <p className="item-notes">{item.notes}</p>}
      <div className="item-actions">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="product-link">View item ↗</a> : <span className="no-link">A little idea, no link yet</span>}
      {!shared && <div><button aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)} disabled={busy}>Edit</button><button aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)} disabled={busy}>Remove</button></div>}</div>
      {shared && <button className={`purchase-button ${item.purchased ? 'marked' : ''}`} onClick={() => onPurchase(item)} disabled={busy}>{item.purchased ? '✓ Purchased · undo' : 'Mark as purchased'}</button>}
    </div>
  </article>
}

export default function WishlistPage({ route }) {
  const shared = route.startsWith('/shared/')
  const recovery = route.match(/^\/edit\/([a-f0-9]{48})\/([a-f0-9]{48})$/)
  const [credentials, setCredentials] = useState(() => recovery ? { viewToken: recovery[1], editToken: recovery[2] } : readSaved(ownerKey, null))
  const viewToken = shared ? route.split('/')[2] : credentials?.viewToken
  const [list, setList] = useState(() => shared || credentials ? null : readDraft(holiday.wishlist.storageKey))
  const [loading, setLoading] = useState(!!viewToken)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [filter, setFilter] = useState('all')
  const local = !shared && !credentials

  async function load() {
    if (!viewToken) return
    setLoading(true); setError('')
    try { setList(await request(`/${viewToken}`, { editToken: shared ? undefined : credentials.editToken })) }
    catch (error) { setError(error.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [viewToken, shared])
  useEffect(() => {
    if (!recovery) return
    try { localStorage.setItem(ownerKey, JSON.stringify(credentials)) }
    catch { setNotice('Bookmark your private editing link so you can return to your list.') }
    window.history.replaceState(null, '', `${window.location.pathname}#/wishlist`)
  }, [])
  useEffect(() => {
    const refresh = () => { if (viewToken && !busy && !editor && !deleting && !renaming) load() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [viewToken, busy, editor, deleting, renaming])

  function saveLocal(next) {
    // Do not clear the form or report success if browser storage fails.
    localStorage.setItem(draftKey, JSON.stringify(next))
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
      if ((values.url && !productUrl(values.url)) || (values.image && !productUrl(values.image))) throw new Error('Use complete http:// or https:// links.')
      if (local) {
        if (!editor.id && list.items.length >= 200) throw new Error('Your list can hold up to 200 wishes.')
        const item = { ...values, name: values.name.trim(), id: editor.id || crypto.randomUUID() }
        saveLocal({ ...list, items: editor.id ? list.items.map(old => old.id === item.id ? item : old) : [item, ...list.items] })
      } else setList(await request(`/${viewToken}/items${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PUT' : 'POST', body: values, editToken: credentials.editToken }))
      setEditor(null); setNotice('Wish saved. A little closer to something lovely.')
    })
  }
  function removeItem() { return perform(async () => {
    if (local) saveLocal({ ...list, items: list.items.filter(item => item.id !== deleting.id) })
    else setList(await request(`/${viewToken}/items/${deleting.id}`, { method: 'DELETE', editToken: credentials.editToken }))
    setDeleting(null); setNotice('Wish removed.')
  }) }
  function rename(event) { event.preventDefault(); return perform(async () => {
    if (!name.trim()) throw new Error('Give your list a name.')
    if (local) saveLocal({ ...list, name: name.trim() })
    else setList(await request(`/${viewToken}`, { method: 'PATCH', body: { name }, editToken: credentials.editToken }))
    setRenaming(false)
  }) }
  function shareList() { setSharing(true); setError('') }
  function enableSharing() { return perform(async () => {
    // Save recovery details before publishing, so a storage failure cannot lose access.
    localStorage.setItem(draftKey, JSON.stringify(list))
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
  const editUrl = credentials ? `${base}#/edit/${credentials.viewToken}/${credentials.editToken}` : ''
  const items = list?.items.filter(item => filter !== 'love' || item.priority === 'love') || []

  return <main className="wishlist-page">
    <a className="back-link" href="#/">← Back to the magic</a>
    <div className="list-heading"><div><p className="eyebrow">{shared ? 'A little inspiration for giving' : 'Your own little corner of magic'}</p><h1>{list?.name || (shared ? 'A little wishlist' : 'My wishlist')}<span className="list-heading-star" aria-hidden="true">✦</span></h1><p>{shared ? 'Thoughtful gifts start with a little hint. Find something they’ll love.' : 'All the things you love, in one lovely little place.'}</p></div>
      {!shared && list && <div className="list-toolbar"><button className="secondary-button" onClick={shareList} disabled={busy}>Share my list ↗</button><button className="primary-button" onClick={() => setEditor({})} disabled={busy}>+ Add an item</button></div>}
    </div>
    {local && <div className="list-info"><span aria-hidden="true">✧</span><p>Your list is saved in this browser. Sharing will be available when the database is connected.</p><span className="mode-badge">Local draft</span></div>}
    {shared && <div className="list-info"><span aria-hidden="true">♡</span><p>Purchase markers stay out of the owner’s editing view. Anyone with this shared link can see and update them.</p><button onClick={load} disabled={loading || busy}>Refresh list ↻</button></div>}
    {!local && !shared && list && <div className="list-info"><span aria-hidden="true">✓</span><p>Saved to your list. Your private editing link is available under “Share my list.”</p><button onClick={load} disabled={loading || busy}>Refresh ↻</button></div>}
    {error && <div className="list-error" role="alert">{error}{viewToken && <button onClick={load} disabled={loading}>Try refreshing</button>}</div>}
    {notice && <p className="list-notice" role="status">{notice}</p>}
    {sharing && <section className="share-panel" aria-label="Share your wishlist"><div className="panel-title"><h2>A little joy, shared.</h2><button className="icon-button" onClick={() => setSharing(false)} aria-label="Close sharing options">×</button></div>
      {local ? <><p>Your draft is ready. Connect MongoDB on the server to create a link that stays up to date.</p><button className="primary-button" onClick={enableSharing} disabled={busy}>{busy ? 'Connecting…' : 'Connect & create sharing link'}</button><p className="fine-print">The app must also be hosted at an address your recipient can open.</p></> : <>
        <label htmlFor="share-link">Share this with your gift-givers</label><div className="copy-row"><input id="share-link" value={shareUrl} readOnly onFocus={event => event.target.select()} /><button className="secondary-button" onClick={() => copy(shareUrl)}>Copy link</button></div>
        <details><summary>Your private editing link</summary><p>Keep this for yourself. Anyone with this link can change your list. Bookmark it to edit from another device.</p><div className="copy-row"><input aria-label="Private editing link" value={editUrl} readOnly onFocus={event => event.target.select()} /><button className="secondary-button" onClick={() => copy(editUrl)}>Copy</button></div></details>
        {['localhost', '127.0.0.1'].includes(window.location.hostname) && <p className="fine-print">This address is local to this computer. Deploy the app before sending this link to someone on another device.</p>}
      </>}
    </section>}
    {loading && !list ? <div className="list-empty" role="status">Gathering your little wishes…</div> : list && <>
      <div className="list-controls"><div className="filter-tabs" aria-label="Filter wishes"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All wishes <span>{list.items.length}</span></button><button aria-pressed={filter === 'love'} onClick={() => setFilter('love')}>♡ Love this <span>{list.items.filter(item => item.priority === 'love').length}</span></button></div>{!shared && <button className="rename-button" onClick={() => { setName(list.name); setRenaming(!renaming) }} disabled={busy}>Rename list</button>}</div>
      {renaming && <form onSubmit={rename} className="rename-form"><label htmlFor="list-name">List name</label><input autoFocus id="list-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required /><button className="secondary-button" disabled={busy}>Save name</button><button type="button" onClick={() => setRenaming(false)}>Cancel</button></form>}
      {items.length ? <div className="wishlist-grid">{items.map(item => <ItemCard key={item.id} item={item} shared={shared} onEdit={setEditor} onRemove={setDeleting} busy={busy} onPurchase={item => perform(async () => setList(await request(`/${viewToken}/purchases/${item.id}`, { method: 'PATCH', body: { purchased: !item.purchased } })))} />)}</div> : <div className="list-empty"><span aria-hidden="true">✦</span><h2>{filter === 'love' ? 'Room for a favorite.' : 'Every wish starts somewhere.'}</h2><p>{filter === 'love' ? 'Wishes marked “Love this” will appear here.' : shared ? 'There aren’t any wishes here just yet. Check back soon.' : 'A cozy sweater, that perfect book, a little adventure. What’s first?'}</p>{!shared && <button className="primary-button" onClick={() => setEditor({})}>+ Add your first wish</button>}</div>}
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

import { useEffect, useRef, useState } from 'react'
import { primaryDetails, emptyItem, priorities, wishCurrency } from '../config/wishFields.js'
import { photoUrl, preparePhoto } from '../lib/photos.js'
import Icon from './Icon.jsx'

export default function ItemForm({ item, onSave, onClose, busy, error }) {
  const [values, setValues] = useState(() => {
    const remaining = (item?.details || []).map(detail => ({ ...detail }))
    const standard = primaryDetails.map(({ label }) => {
      const index = remaining.findIndex(detail => detail.label.toLowerCase() === label.toLowerCase())
      return { label, value: index < 0 ? '' : remaining.splice(index, 1)[0].value }
    })
    return { ...emptyItem, ...item, currency: wishCurrency, details: [...standard, ...remaining] }
  })
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const dialog = useRef(null)
  const alive = useRef(true)
  const detailFocus = useRef(null)
  const photoPicker = useRef(null)
  const cameraPicker = useRef(null)
  const locked = busy || photoBusy
  useEffect(() => {
    alive.current = true
    dialog.current.showModal()
    return () => { alive.current = false }
  }, [])
  function change(event) {
    const { name, value } = event.target
    setValues(current => ({ ...current, [name]: value }))
  }
  function addDetail(label = '') {
    setValues(current => ({ ...current, details: [...current.details, { label, value: '' }] }))
    detailFocus.current = { index: values.details.length, field: label ? 'value' : 'label' }
  }
  function changeDetail(index, field, value) {
    setValues(current => ({ ...current, details: current.details.map((detail, i) => i === index ? { ...detail, [field]: value } : detail) }))
  }
  useEffect(() => {
    if (detailFocus.current) {
      const { index, field } = detailFocus.current
      dialog.current.querySelector(`#detail-${field}-${index}`)?.focus()
      detailFocus.current = null
    }
  }, [values.details.length])
  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true); setPhotoError('')
    try {
      const image = await preparePhoto(file)
      if (alive.current) setValues(current => ({ ...current, image }))
    } catch (error) { if (alive.current) setPhotoError(error.message) }
    finally { if (alive.current) setPhotoBusy(false) }
  }
  const preview = photoUrl(values.image)
  const uploaded = values.image.startsWith('data:') || values.image.startsWith('/uploads/')
  return <dialog ref={dialog} className="item-dialog wish-editor" aria-labelledby="wish-editor-title" aria-describedby="wish-editor-help" aria-busy={locked} onCancel={event => { if (locked) event.preventDefault(); else onClose() }} onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault()
      if (locked) return
      const incomplete = values.details.slice(primaryDetails.length).some(detail => (!!detail.label.trim()) !== (!!detail.value.trim()))
      if (incomplete) { setPhotoError('Give each extra detail both a label and a value, or remove the empty part.'); return }
      setPhotoError('')
      onSave({ ...values, details: values.details.filter(detail => detail.label.trim() && detail.value.trim()).map(detail => ({ label: detail.label.trim(), value: detail.value.trim() })) })
    }}>
      <div className="dialog-heading"><div><h2 id="wish-editor-title">{item ? 'Edit wish' : 'New wish'}</h2><p className="description-help" id="wish-editor-help">Only the name is required.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={locked} aria-label="Close item form"><Icon name="close" /></button></div>
      <fieldset disabled={locked} className="wish-fields">
        <label htmlFor="item-name">Item name <span>*</span></label><input autoFocus id="item-name" name="name" value={values.name} onChange={change} maxLength={160} required placeholder="Something you’d love" />
        <section className="wish-form-section" aria-labelledby="where-heading">
          <h3 id="where-heading">Where to find it</h3>
          <label htmlFor="item-store">Store</label><input id="item-store" name="store" value={values.store} onChange={change} maxLength={160} placeholder="Online shop or a store in town" />
          <label htmlFor="item-url">Product link</label><input id="item-url" name="url" type="url" pattern="https?://.*" title="Use an http:// or https:// link" value={values.url} onChange={change} maxLength={2048} placeholder="https://your-favorite-store.com/item" />
          <label htmlFor="item-price">Cost (CAD)</label><input id="item-price" name="price" value={values.price} onChange={change} maxLength={60} placeholder="e.g. $45 or about $40–50" />
        </section>
        <section className="wish-form-section" aria-labelledby="details-heading">
          <h3 id="details-heading">Item details</h3>
          <div className="form-columns">{primaryDetails.map(({ label, placeholder }, index) => <div key={label}><label htmlFor={`detail-value-${index}`}>{label}</label><input id={`detail-value-${index}`} type="text" value={values.details[index].value} onChange={event => changeDetail(index, 'value', event.target.value)} maxLength={300} placeholder={placeholder} /></div>)}</div>
          {values.details.slice(primaryDetails.length).map((detail, offset) => {
            const index = offset + primaryDetails.length
            return <div className="detail-editor-row" key={index}>
            <div><label htmlFor={`detail-label-${index}`}>Extra detail {offset + 1}</label><input id={`detail-label-${index}`} value={detail.label} onChange={event => changeDetail(index, 'label', event.target.value)} maxLength={60} placeholder="e.g. Personalization" /></div>
            <div><label htmlFor={`detail-value-${index}`}>Value</label><input id={`detail-value-${index}`} type="text" value={detail.value} onChange={event => changeDetail(index, 'value', event.target.value)} maxLength={300} placeholder={detail.label.toLowerCase() === 'size' ? 'e.g. 00, Medium, 28 × 30' : 'Your preference'} /></div>
            <button type="button" className="remove-detail" aria-label={`Remove detail ${index + 1}${detail.label ? `: ${detail.label}` : ''}`} onClick={() => setValues(current => ({ ...current, details: current.details.filter((_, i) => i !== index) }))}><Icon name="close" /></button>
          </div>})}
          <button type="button" className="add-detail-button" onClick={() => addDetail()} disabled={values.details.length >= 30}><Icon name="plus" />Add another detail</button>
          <label htmlFor="item-alternatives">Other options</label><textarea id="item-alternatives" name="alternatives" value={values.alternatives} onChange={change} maxLength={1000} rows={2} placeholder="Green preferred, black is fine. Or: this exact version only." />
          <div className="form-columns"><div><label htmlFor="item-quantity">Quantity</label><input id="item-quantity" name="quantity" type="number" min="1" max="999" step="1" value={values.quantity} onChange={change} placeholder="1" /></div><div><label htmlFor="item-priority">Priority</label><select id="item-priority" name="priority" value={values.priority} onChange={change}>{priorities.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}</select></div></div>
          <label htmlFor="item-notes">Notes</label><textarea id="item-notes" name="notes" value={values.notes} onChange={change} maxLength={1000} rows={3} placeholder="Anything else your gift-giver should know…" />
        </section>
        <section className="wish-form-section" aria-labelledby="photo-heading">
          <h3 id="photo-heading">Photo</h3>
          <div className="photo-actions"><button type="button" className="primary-button" onClick={() => cameraPicker.current.click()}><Icon name="camera" />Take a photo</button><button type="button" className="secondary-button" onClick={() => photoPicker.current.click()}><Icon name="photo" />Choose a photo</button></div>
          <input ref={cameraPicker} className="photo-file-input" type="file" accept="image/*" capture="environment" onChange={upload} aria-label="Take a photo" tabIndex={-1} />
          <input ref={photoPicker} className="photo-file-input" id="item-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} aria-label="Choose a photo" tabIndex={-1} />
          <p className="description-help" id="photo-help">JPG, PNG, or WebP · Up to 20 MB</p>
          <label htmlFor="item-image">Or paste a photo link</label><input id="item-image" name="image" type="url" pattern="https?://.*" value={uploaded ? '' : values.image} onChange={change} maxLength={2048} placeholder="https://…/photo.jpg" />
          {preview && <div className="photo-preview"><img src={preview} alt="Preview of your wish" referrerPolicy="no-referrer" /><button type="button" className="secondary-button" onClick={() => setValues(current => ({ ...current, image: '' }))}>Remove photo</button></div>}
        </section>
      </fieldset>
      {photoBusy && <p className="description-help" role="status">Preparing your photo…</p>}
      {(photoError || error) && <p className="list-error" role="alert">{photoError || error}</p>}
      <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={locked}>Cancel</button><button className="primary-button" disabled={locked}>{photoBusy ? 'Preparing photo…' : busy ? 'Saving…' : item ? 'Save changes' : 'Save wish'}</button></div>
    </form>
  </dialog>
}

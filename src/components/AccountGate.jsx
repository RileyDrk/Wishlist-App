import { useEffect, useState } from 'react'
import { authRequest, useAccount } from '../lib/accounts.jsx'
import { loadDraft, saveDraft } from '../lib/draftStorage.js'
import { holiday } from '../config/holiday.js'
import Icon from './Icon.jsx'

export default function AccountGate() {
  const { loading, error: sessionError, reload, preview, setSession } = useAccount()
  const [register, setRegister] = useState(false)
  const [values, setValues] = useState({ name: '', username: '', password: '', confirmPassword: '' })
  const [importDraft, setImportDraft] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadDraft(holiday.wishlist.storageKey).then(value => { if (active) setDraft(value) }).catch(() => {})
    return () => { active = false }
  }, [])
  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }))
  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      if (register && values.password !== values.confirmPassword) throw new Error('The passwords do not match.')
      const body = { name: values.name, username: values.username, password: values.password, ...(register ? { items: importDraft ? draft?.items || [] : [] } : {}) }
      const session = await authRequest(register ? 'register' : 'login', body)
      if (register && importDraft) {
        try { await saveDraft({ name: 'My wishlist', items: [] }) }
        catch { /* Account creation succeeded; retain the legacy draft as a backup. */ }
      }
      setSession(session)
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  if (loading) return <main className="list-empty" role="status">Opening your wishlist…</main>
  if (sessionError) return <main className="list-empty"><p role="alert">{sessionError}</p><button className="primary-button" onClick={reload}>Try again</button></main>
  return <main className="account-page">
    <section className="account-card">
      <span className="account-gift"><Icon name="gift" /></span>
      <h1>{register ? 'Your own little wishlist' : 'Welcome back'}</h1>
      <p>{register ? 'One account. One list. Share it with the people you choose.' : 'Sign in to add wishes and share your list.'}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {register && <><label htmlFor="account-name">Your name</label><input id="account-name" name="name" autoComplete="given-name" value={values.name} onChange={change} maxLength={80} required /></>}
          <label htmlFor="account-username">Username</label><input id="account-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={values.username} onChange={change} minLength={3} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}" required aria-describedby={register ? 'username-help' : undefined} />
          {register && <p id="username-help" className="description-help">3–32 letters, numbers, dots, underscores, or hyphens.</p>}
          <label htmlFor="account-password">Password</label><input id="account-password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} value={values.password} onChange={change} minLength={10} maxLength={128} required aria-describedby={register ? 'password-help' : undefined} />
          {register && <p id="password-help" className="description-help">At least 10 characters. Keep it somewhere safe; password recovery isn’t available yet.</p>}
          {register && <><label htmlFor="account-confirm-password">Confirm password</label><input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={change} minLength={10} maxLength={128} required /></>}
          {register && !!draft?.items.length && <label className="draft-import-note"><input type="checkbox" checked={importDraft} onChange={event => setImportDraft(event.target.checked)} />Bring the {draft.items.length} existing draft {draft.items.length === 1 ? 'wish' : 'wishes'} on this device into my account.</label>}
          {error && <p className="list-error" role="alert">{error}</p>}
          <button className="primary-button account-submit" disabled={busy}>{busy ? 'Just a moment…' : register ? 'Create my account' : 'Sign in'}</button>
        </fieldset>
      </form>
      <p className="account-switch">{register ? 'Already have an account?' : 'First time here?'} <button type="button" disabled={busy} onClick={() => { setRegister(!register); setValues(current => ({ ...current, password: '', confirmPassword: '' })); setError('') }}>{register ? 'Sign in' : 'Create an account'}</button></p>
      {preview && <p className="preview-note">Preview accounts are saved on this computer, separate from the future live site.</p>}
    </section>
  </main>
}

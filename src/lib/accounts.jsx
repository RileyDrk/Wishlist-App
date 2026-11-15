import { createContext, useContext, useEffect, useRef, useState } from 'react'

const AccountContext = createContext(null)
export async function authRequest(action, body) {
  const response = await fetch(`/api/auth/${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).catch(() => { throw new Error('Could not reach the server. Please try again.') })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not sign in. Please try again.')
  return data
}

export function AccountProvider({ children }) {
  const [session, setSession] = useState({ user: null, preview: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  function acceptSession(value) { generation.current += 1; setError(''); setLoading(false); setSession(value) }
  async function reload({ quiet = false } = {}) {
    const requestGeneration = ++generation.current
    if (!quiet) { setLoading(true); setError('') }
    try {
      const result = await authRequest('session')
      if (requestGeneration === generation.current) { setSession(result); setError('') }
    }
    catch (error) { if (!quiet && requestGeneration === generation.current) setError(error.message) }
    finally { if (requestGeneration === generation.current) setLoading(false) }
  }
  useEffect(() => {
    reload()
    const refresh = () => { if (document.visibilityState !== 'hidden') reload({ quiet: true }) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      generation.current += 1
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  async function logout() {
    setError('')
    try { acceptSession(await authRequest('logout', {})) }
    catch (error) { setError(error.message) }
  }
  return <AccountContext.Provider value={{ ...session, loading, error, reload, logout, setSession: acceptSession }}>{children}</AccountContext.Provider>
}
export const useAccount = () => useContext(AccountContext)

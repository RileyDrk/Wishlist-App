import { useEffect, useState } from 'react'
import { holiday } from './config/holiday.js'
import { getCountdown } from './lib/countdown.js'
import WishlistPage from './components/WishlistPage.jsx'
import Icon from './components/Icon.jsx'
import AccountGate from './components/AccountGate.jsx'
import { useAccount } from './lib/accounts.jsx'
import FestiveBackground from './components/FestiveBackground.jsx'

function Countdown() {
  const [time, setTime] = useState(() => getCountdown(holiday.date))
  useEffect(() => {
    const timer = setInterval(() => setTime(getCountdown(holiday.date)), 1000)
    return () => clearInterval(timer)
  }, [])
  return <div className="countdown-wrap">
    <p>{time.isHoliday ? 'Merry Christmas!' : `Counting down to ${holiday.name}`}</p>
    <div className="countdown" role="timer" aria-label={`Time until ${holiday.name}`}>
      {Object.entries(time.remaining).map(([unit, value]) => <div className="time-unit" key={unit}><span className="time-value">{String(value).padStart(2, '0')}</span><span className="time-label">{unit}</span></div>)}
    </div>
  </div>
}

function HolidayIllustration() {
  return <div className="holiday-art"><svg viewBox="0 0 480 420" role="img" aria-label={holiday.art.description}>
    <ellipse cx="242" cy="213" rx="204" ry="178" fill="var(--scene-background)" />
    <path d="m305 62-56 83h27l-47 73h30l-54 82h198l-54-82h30l-47-73h27Z" fill="var(--tree-color)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
    <path d="M303 300v33" stroke="var(--gold)" strokeWidth="22" />
    <path d="m305 33 7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2Z" fill="var(--gold)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M270 164q35 25 69 0m-88 75q55 31 108 0" fill="none" stroke="var(--ribbon-color)" strokeWidth="5" />
    <g fill="var(--accent)" stroke="var(--paper)" strokeWidth="3"><circle cx="286" cy="143" r="8" /><circle cx="325" cy="207" r="9" /><circle cx="277" cy="271" r="9" /><circle cx="352" cy="275" r="8" /></g>
    <g transform="rotate(-8 163 292)"><rect x="80" y="243" width="166" height="117" rx="12" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" /><rect x="72" y="224" width="182" height="32" rx="9" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" /><path d="M162 225v135" stroke="var(--ribbon-color)" strokeWidth="26" /><path d="M162 224c-69 0-62-66-24-38l24 38c69 0 62-66 24-38Z" fill="none" stroke="var(--ribbon-color)" strokeWidth="13" strokeLinejoin="round" /></g>
    <g transform="rotate(7 305 333)"><rect x="247" y="304" width="116" height="76" rx="10" fill="var(--gold)" stroke="var(--ink)" strokeWidth="4" /><path d="M305 305v74M247 326h116" stroke="var(--paper)" strokeWidth="16" /></g>
    <g fill="var(--gold)"><path d="m96 91 7 17 18 7-18 7-7 18-7-18-18-7 18-7Z" /><path d="m408 151 4 11 12 5-12 4-4 12-5-12-11-4 11-5Z" /></g>
    <g fill="var(--paper)"><circle cx="190" cy="85" r="5" /><circle cx="395" cy="244" r="5" /><circle cx="61" cy="202" r="5" /><circle cx="208" cy="155" r="4" /></g>
  </svg></div>
}

export default function App() {
  const account = useAccount()
  const [signingOut, setSigningOut] = useState(false)
  const [snowPaused, setSnowPaused] = useState(() => {
    try { return localStorage.getItem('wishlist:snow-paused') === 'true' }
    catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('wishlist:snow-paused', String(snowPaused)) }
    catch { /* The snow control still works when browser storage is unavailable. */ }
  }, [snowPaused])
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    const navigate = () => { setRoute(window.location.hash.slice(1) || '/'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  const isHome = route === '/' || route === ''
  const isWishlist = route === '/wishlist' || /^\/(shared|edit)\//.test(route)
  useEffect(() => {
    document.title = holiday.pageTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', holiday.description)
  }, [])
  return <div className="holiday-page" style={Object.fromEntries(Object.entries(holiday.theme).map(([key, value]) => [`--${key}`, value]))}>
    <FestiveBackground snow={holiday.art.snow} paused={snowPaused} />
    <div className="page-shell">
      <header className="site-header"><a className="wordmark" href="#/"><span className="brand-icon"><Icon name="gift" /></span><span>{holiday.brand}</span></a><nav aria-label="Main navigation"><a className="nav-wishlist" href="#/wishlist" aria-current={route === '/wishlist' ? 'page' : undefined}>My wishlist <Icon name="heart" /></a>{account.user && <button className="signout-button" disabled={signingOut} onClick={async () => { setSigningOut(true); try { await account.logout() } finally { setSigningOut(false) } }}>{signingOut ? 'Signing out…' : 'Sign out'}</button>}</nav></header>
      {account.user && account.error && <p className="list-error" role="alert">{account.error}</p>}
      {isHome ? <main><section className="hero"><div className="hero-copy"><p className="season-label"><Icon name="star" />{holiday.name} wishes</p><h1>{holiday.hero.heading}<br /><em>{holiday.hero.accent}</em></h1><p className="hero-description">{holiday.hero.description}</p><a className="primary-button" href="#/wishlist">{holiday.hero.cta}<Icon name="arrow" /></a><Countdown /></div><HolidayIllustration /></section></main> : isWishlist ? (route.startsWith('/shared/') || route.startsWith('/edit/') || account.user) ? <WishlistPage key={`${route}:${account.user?.username || 'guest'}`} route={route} account={account.user} /> : <AccountGate /> : <main className="list-empty"><Icon name="gift" /><h1>Page not found</h1><a className="primary-button" href="#/wishlist">Go to my wishlist</a></main>}
      <footer><Icon name="gift" /><span>A little list. A lot to look forward to.</span>{holiday.art.snow && <button className="snow-toggle" onClick={() => setSnowPaused(value => !value)} aria-pressed={snowPaused}>{snowPaused ? 'Resume snow' : 'Pause snow'}</button>}</footer>
    </div>
  </div>
}

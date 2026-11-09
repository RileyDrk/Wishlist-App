import { useEffect, useState } from 'react'
import { holiday } from './config/holiday.js'
import { getCountdown } from './lib/countdown.js'
import WishlistPage from './components/WishlistPage.jsx'

function Countdown() {
  const [time, setTime] = useState(() => getCountdown(holiday.date))
  useEffect(() => {
    const timer = setInterval(() => setTime(getCountdown(holiday.date)), 1000)
    return () => clearInterval(timer)
  }, [])
  return <div className="countdown-wrap">
    <p className="eyebrow">{time.isHoliday ? holiday.countdown.arrived : holiday.countdown.label}</p>
    <div className="countdown" role="timer" aria-label={`Time until ${holiday.name}`}>
      {Object.entries(time.remaining).map(([unit, value]) => <div className="time-unit" key={unit}><span className="time-value">{String(value).padStart(2, '0')}</span><span className="time-label">{unit}</span></div>)}
    </div>
    <p className="countdown-note">{holiday.countdown.note}</p>
  </div>
}

function HolidayIllustration() {
  return <div className="holiday-art" role="img" aria-label={holiday.art.description}>
    <div className="art-orbit" />
    {holiday.art.snow && <div className="snowfall" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
    <span className="art-star star-one">✦</span><span className="art-star star-two">✦</span><span className="art-star star-three">✦</span>
    <div className="hanging-ornament ornament-one"><span /></div><div className="hanging-ornament ornament-two"><span /></div>
    <div className="tree"><span className="tree-top">✦</span><i /><i /><i /><b /></div>
    <div className="gift gift-back"><span className="bow" /><i /></div>
    <div className="gift gift-front"><span className="bow" /><i /><span className="gift-tag">{holiday.art.giftTag}</span></div>
    <span className="art-sticker">{holiday.art.sticker}</span>
    <div className="art-caption"><span />{holiday.art.caption}<span /></div>
  </div>
}

export default function App() {
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
    <div className="announcement"><span aria-hidden="true">✦</span>{holiday.announcement}<span aria-hidden="true">✦</span></div>
    <div className="page-shell">
      <header className="site-header"><a className="wordmark" href="#/"><span className="brand-icon" aria-hidden="true">{holiday.symbol}</span>{holiday.brand}<span className="wordmark-dot">.</span></a><nav aria-label="Main navigation"><a className="nav-wishlist" href="#/wishlist">My wishlist <span aria-hidden="true">↗</span></a></nav></header>
      {isHome ? <main><section className="hero" id="countdown"><div className="hero-copy"><p className="eyebrow hero-eyebrow"><span />{holiday.hero.eyebrow}</p><h1>{holiday.hero.heading}<br /><em>{holiday.hero.accent}</em><span className="heading-star" aria-hidden="true">✦</span></h1><p className="hero-description">{holiday.hero.description}</p><a className="primary-button" href="#/wishlist">{holiday.hero.cta}<span aria-hidden="true">↗</span></a><Countdown /></div><HolidayIllustration /></section>
      <div className="season-strip">{holiday.highlights.map((item, index) => <span key={item}>{index > 0 && <b aria-hidden="true">✦</b>}{item}</span>)}</div></main> : isWishlist ? <WishlistPage key={route} route={route} /> : <main className="list-empty"><h1>Lost in the snow?</h1><p>This page could not be found.</p><a className="primary-button" href="#/">Back home</a></main>}
      <footer><a className="footer-brand" href="#/">{holiday.brand}<span>.</span></a><p>{holiday.footer}</p><span>{holiday.symbol} {holiday.name}</span></footer>
    </div>
  </div>
}

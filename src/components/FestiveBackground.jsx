function Snowflake() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1M4 14l4 1-1 4M17 5l-1 4 4 1" /></svg>
}

function Ornaments() {
  return <svg viewBox="0 0 120 260" fill="none">
    <path d="M36 0v95M87 0v159" stroke="var(--gold)" strokeWidth="2" />
    <path d="M30 93h12v10H30Z" fill="var(--gold)" />
    <circle cx="36" cy="130" r="30" fill="var(--accent)" />
    <path d="M10 120q26 18 52 0M10 137q26 18 52 0" stroke="var(--ribbon-color)" strokeWidth="4" />
    <ellipse cx="26" cy="115" rx="5" ry="8" fill="white" opacity=".3" transform="rotate(30 26 115)" />
    <path d="M81 157h12v9H81Z" fill="var(--ink)" />
    <circle cx="87" cy="187" r="24" fill="var(--gold)" />
    <path d="m87 173 3 9 9 1-7 6 2 9-7-5-7 5 2-9-7-6 9-1Z" fill="var(--paper)" />
    <path d="m25 211 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="var(--gold)" />
  </svg>
}

function Holly() {
  return <svg viewBox="0 0 140 130" fill="none"><path d="M74 78C22 87 11 60 12 25c15 7 21 3 24-12 13 20 24 20 30 11 9 22 8 37 8 54Z" fill="var(--tree-color)" /><path d="M76 78c-8-39 15-59 48-62-4 16 2 21 14 23-19 13-19 23-9 29-20 10-37 10-53 10Z" fill="var(--ink)" /><path d="M28 33 73 80m41-49L77 80" stroke="var(--scene-background)" strokeWidth="2" /><g fill="var(--accent)" stroke="var(--background)" strokeWidth="3"><circle cx="67" cy="81" r="12" /><circle cx="88" cy="84" r="12" /><circle cx="76" cy="101" r="12" /></g></svg>
}

export default function FestiveBackground({ snow, paused }) {
  return <><div className="festive-background" aria-hidden="true">
    <div className="festive-lights">{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ '--bulb-color': ['var(--accent)', 'var(--gold)', 'var(--tree-color)'][index % 3], '--bulb-drop': `${index % 3 * 4}px` }} />)}</div>
    <div className="festive-ornaments ornaments-left"><Ornaments /></div>
    <div className="festive-ornaments ornaments-right"><Ornaments /></div>
    <div className="festive-holly holly-left"><Holly /></div>
    <div className="festive-holly holly-right"><Holly /></div>
    </div>
    {snow && <div className={`festive-snow${paused ? ' snow-paused' : ''}`} aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <span key={index} className={index % 5 === 0 ? 'snow-crystal' : 'snow-dot'} style={{
      left: `${(index * 47 + 9) % 100}%`,
      '--snow-size': `${index % 5 === 0 ? 20 + index % 9 : 6 + index % 6}px`,
      '--snow-speed': `${13 + index % 13}s`,
      '--snow-delay': `${-(index * 7 % 29)}s`,
      '--snow-drift': `${index % 2 === 0 ? 35 : -40}px`,
    }}>{index % 5 === 0 && <Snowflake />}</span>)}</div>}
  </>
}

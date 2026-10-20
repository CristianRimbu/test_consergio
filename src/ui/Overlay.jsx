import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { state, CHAPTERS, DASH, range } from '../story'
import { Logo, Picto } from './Logo'

const SITE = 'https://www.consergio.ai/it'

// [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] in story progress
const CAPTIONS = [
  {
    id: 'arrive', r: [0.115, 0.13, 0.19, 0.205], side: 'left',
    kicker: 'Ore 15:00 · Hotel Belvedere',
    title: 'Arrivano gli ospiti.',
    text: 'Da Milano, da Monaco, da Lione, da Madrid. Ognuno con le sue domande, nella sua lingua.',
  },
  {
    id: 'lobby', r: [0.248, 0.262, 0.378, 0.392], side: 'right',
    kicker: 'Il lavoro che non si vede',
    title: 'La reception è piena. Le domande, sempre le stesse.',
    text: 'Orari, Wi-Fi, parcheggio, dove mangiare stasera. Arrivano tutte a te, di solito mentre stai facendo altro, e non sempre in una lingua che conosci.',
    counter: true,
  },
  {
    id: 'lift', r: [0.418, 0.432, 0.5, 0.515], side: 'right',
    kicker: 'Check-in fatto',
    title: 'Da qui in poi, ci pensa ConSergio.',
    text: 'Niente app da scaricare, niente account da creare. Basta il browser del telefono.',
  },
  {
    id: 'room', r: [0.59, 0.604, 0.69, 0.705], side: 'left',
    kicker: 'Camera 101',
    title: 'Sul comodino, un QR li aspetta.',
    text: 'Generi un QR per ogni camera o area comune, pronto da stampare. Niente hardware da installare: l’ospite inquadra e basta.',
  },
  {
    id: 'chat', r: [0.758, 0.772, 0.836, 0.85], side: 'left',
    kicker: 'Inquadra e chiedi',
    title: 'Risponde subito. Nella loro lingua.',
    text: 'L’ospite scrive come gli viene naturale. ConSergio risponde con le informazioni della tua struttura e, quando serve, passa la richiesta allo staff.',
    langs: true,
  },
  {
    id: 'staff', r: [0.893, 0.903, 0.942, 0.954], side: 'left',
    kicker: 'Dashboard struttura',
    title: 'Allo staff arriva solo quello che va fatto di persona.',
    text: 'Ogni richiesta arriva in tempo reale, con il numero di camera in cima e la lingua dell’ospite. La prendi in carico con un tocco e l’ospite vede lo stato aggiornarsi da solo.',
  },
]

const LANGS = ['🇮🇹 IT', '🇬🇧 EN', '🇩🇪 DE', '🇫🇷 FR', '🇪🇸 ES', '🇳🇱 NL', '🇵🇱 PL', '🇯🇵 JA', '+42']

function useStoryLoop(fn) {
  useEffect(() => {
    let raf
    const loop = () => {
      fn(state.s)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
}

const fade = (s, [a, b, c, d]) => range(s, a, b) * (1 - range(s, c, d))

export function Header({ onNav }) {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`top ${solid ? 'top--solid' : ''}`}>
      <a href="#" className="top__logo" onClick={(e) => (e.preventDefault(), onNav(0))}>
        <Logo tone="dark" className="logo logo--dark" />
        <Logo tone="light" className="logo logo--light" />
      </a>
      <nav className="top__nav">
        <a href="#storia" onClick={(e) => (e.preventDefault(), onNav(0.135))}>Come funziona</a>
        <a href="#funzioni">Funzioni</a>
        <a href="#moduli">Moduli</a>
        <a href="#per-chi">Per chi è</a>
      </nav>
      <a className="btn btn--primary btn--sm" href={SITE} target="_blank" rel="noreferrer">Attiva ora</a>
    </header>
  )
}

export function Loader() {
  const { progress, active } = useProgress()
  const [gone, setGone] = useState(false)
  const done = progress >= 100 && !active
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => setGone(true), 900)
      return () => clearTimeout(t)
    }
  }, [done])
  if (gone) return null
  return (
    <div className={`loader ${done ? 'loader--done' : ''}`}>
      <Picto className="loader__picto" />
      <div className="loader__bar"><i style={{ width: `${progress}%` }} /></div>
      <p>Stiamo aprendo l’Hotel Belvedere… {Math.round(progress)}%</p>
    </div>
  )
}

export function Hero({ onNav }) {
  const ref = useRef()
  const hint = useRef()
  useStoryLoop((s) => {
    const o = 1 - range(s, 0.012, 0.035)
    ref.current.style.opacity = o
    ref.current.style.transform = `translateY(${-range(s, 0, 0.035) * 80}px)`
    ref.current.style.visibility = o < 0.01 ? 'hidden' : 'visible'
    hint.current.style.opacity = 1 - range(s, 0, 0.01)
  })
  return (
    <>
      <section className="hero" ref={ref}>
        <span className="pill"><i className="dot" /> Il concierge digitale per hotel, B&amp;B e campeggi</span>
        <h1>
          Il concierge che <span className="grad">non dorme mai</span>.
        </h1>
        <p className="hero__lead">
          ConSergio risponde alle domande dei tuoi ospiti e raccoglie le richieste dei servizi che vogliono, in oltre 50
          lingue, 24 ore su 24. A te arriva solo quello che va fatto di persona.
        </p>
        <div className="hero__cta">
          <a className="btn btn--primary" href={SITE} target="_blank" rel="noreferrer">Attiva ora →</a>
          <button className="btn btn--ghost" onClick={() => onNav(0.135)}>Guarda come funziona</button>
        </div>
        <ul className="hero__facts">
          <li><b>50+</b> lingue</li>
          <li><b>24/7</b> sempre attivo</li>
          <li><b>0</b> app da installare</li>
        </ul>
      </section>
      <div className="scroll-hint" ref={hint}>
        <span>Scorri e segui gli ospiti</span>
        <i />
      </div>
    </>
  )
}

export function Captions() {
  const refs = useRef([])
  const counter = useRef()
  useStoryLoop((s) => {
    CAPTIONS.forEach((c, i) => {
      const el = refs.current[i]
      const o = fade(s, c.r)
      el.style.opacity = o
      el.style.transform = `translateY(${(1 - o) * 40}px)`
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
    })
    if (counter.current) counter.current.textContent = Math.round(12 + range(s, 0.25, 0.39) * 35)
  })
  return (
    <div className="captions">
      {CAPTIONS.map((c, i) => (
        <article key={c.id} className={`cap cap--${c.side}`} ref={(el) => (refs.current[i] = el)}>
          <span className="cap__kicker">{c.kicker}</span>
          <h2>{c.title}</h2>
          <p>{c.text}</p>
          {c.counter && (
            <div className="cap__counter">
              <b ref={counter}>12</b>
              <span>domande ripetute
                <br />solo oggi alla reception
              </span>
            </div>
          )}
          {c.langs && (
            <div className="cap__langs">
              {LANGS.map((l) => <span key={l}>{l}</span>)}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

export function Finale({ onNav }) {
  const ref = useRef()
  useStoryLoop((s) => {
    const o = range(s, 0.975, 0.995) * (1 - range(state.after, 0.0, 0.05))
    ref.current.style.opacity = o
    ref.current.style.transform = `translateY(${(1 - o) * 40}px)`
    ref.current.style.visibility = o < 0.01 ? 'hidden' : 'visible'
    ref.current.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
  })
  return (
    <section className="finale" ref={ref}>
      <span className="cap__kicker">Ore 3:12 · reception chiusa</span>
      <h2>Tu riposi. <span className="grad grad--light">ConSergio risponde.</span></h2>
      <p>Un QR in ogni camera, un punto di riferimento sempre disponibile per i tuoi ospiti. Anche quando la reception è chiusa.</p>
      <div className="hero__cta">
        <a className="btn btn--primary" href={SITE} target="_blank" rel="noreferrer">Attiva ConSergio</a>
        <a className="btn btn--ghost btn--ghost-light" href="#funzioni">Scopri tutte le funzioni ↓</a>
      </div>
    </section>
  )
}

const CARDS_OTHER = {
  new: [{ room: 'Camera 5', text: '« Un restaurant ouvert ce soir ? »', lang: '🇫🇷 Francese', ai: true }],
  doing: [{ room: 'Noleggio bici · Camera 3', text: 'Proposta dall’assistente → prenotata', lang: '+30€', ai: false }],
  done: [{ room: 'Late check-out · Camera 15', text: 'Evasa da Giulia', lang: '2 min fa', ai: false }],
}

export function Dashboard() {
  const ref = useRef()
  const [stage, setStage] = useState(0)
  const stageRef = useRef(0)
  useStoryLoop((s) => {
    const o = fade(s, [DASH[0], DASH[0] + 0.008, DASH[1] - 0.012, DASH[1]])
    ref.current.style.opacity = o
    ref.current.style.transform = `translateY(${(1 - o) * 30}px) scale(${0.96 + o * 0.04})`
    ref.current.style.visibility = o < 0.01 ? 'hidden' : 'visible'
    const st = s < 0.906 ? 0 : s < 0.926 ? 1 : 2
    if (st !== stageRef.current) {
      stageRef.current = st
      setStage(st)
    }
  })
  const mine = {
    room: 'Camera 101',
    text: stage === 0 ? '“Due asciugamani in più”' : stage === 1 ? 'Presa in carico da Giulia' : 'Evasa da Giulia · ora',
    lang: '🇮🇹 Italiano',
    ai: true,
    mine: true,
  }
  const col = (key, label, idx) => (
    <div className="dash__col">
      <h4>{label} <span>{CARDS_OTHER[key].length + (stage === idx ? 1 : 0)}</span></h4>
      {stage === idx && <Card {...mine} key={`m${idx}`} />}
      {CARDS_OTHER[key].map((c) => <Card key={c.room} {...c} />)}
    </div>
  )
  return (
    <aside className="dash" ref={ref}>
      <header className="dash__head">
        <Picto className="dash__picto" />
        <div>
          <strong>Hotel Belvedere</strong>
          <small>Bacheca richieste · in tempo reale</small>
        </div>
        <span className="dash__live">● LIVE</span>
      </header>
      <div className="dash__cols">
        {col('new', 'Nuove', 0)}
        {col('doing', 'In lavorazione', 1)}
        {col('done', 'Evase', 2)}
      </div>
    </aside>
  )
}

function Card({ room, text, lang, ai, mine }) {
  return (
    <div className={`card ${mine ? 'card--mine' : ''}`}>
      <strong>{room}</strong>
      <p>{text}</p>
      <div className="card__meta">
        <span>{lang}</span>
        {ai && <span className="card__ai">via assistente AI</span>}
      </div>
    </div>
  )
}

export function Rail({ onNav }) {
  const refs = useRef([])
  useStoryLoop((s) => {
    let active = 0
    CHAPTERS.forEach((c, i) => {
      if (s >= c.at - 0.02) active = i
    })
    refs.current.forEach((el, i) => el && el.classList.toggle('on', i === active))
    refs.current[0].parentElement.style.opacity = s > 0.999 && state.after > 0.02 ? 0 : 1
  })
  return (
    <nav className="rail" aria-label="Capitoli della storia">
      {CHAPTERS.map((c, i) => (
        <button key={c.id} ref={(el) => (refs.current[i] = el)} onClick={() => onNav(c.at)}>
          <span>{c.label}</span>
        </button>
      ))}
    </nav>
  )
}

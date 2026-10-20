import { useEffect, useRef } from 'react'
import { Logo, Picto } from './Logo'

const SITE = 'https://www.consergio.ai/it'

const VERBS = [
  { icon: '💬', title: 'Informa', text: 'Orari, check-in, Wi-Fi, parcheggio. Risponde lui, con le informazioni e i documenti della tua struttura.' },
  { icon: '🗺️', title: 'Organizza', text: 'Propone itinerari, eventi e visite in base a quanto si ferma l’ospite e a cosa gli interessa.' },
  { icon: '🛎️', title: 'Prenota', text: 'Ristorante, SPA, noleggio bici: l’ospite chiede in chat e vede quando il tuo staff ha confermato.' },
  { icon: '📨', title: 'Comunica', text: 'Asciugamani in più, un late check-out. La richiesta ti arriva già scritta, con il numero di camera in cima.' },
]

const STATS = [
  ['50+', 'lingue', 'Ospiti serviti nella loro lingua'],
  ['24/7', 'sempre attivo', 'Risponde anche di notte'],
  ['< 5', 'minuti', 'Per aprire l’account'],
  ['0', 'app', 'Basta inquadrare il QR'],
  ['1', 'canone', 'All’anno, per tutta la struttura'],
]

const WHO = [
  ['🏨', 'Piccoli hotel indipendenti', 'Togli alla reception le domande ripetitive e scopri quali servizi ti chiedono di più.'],
  ['🌿', 'B&B e agriturismi', 'Accogli ospiti stranieri nella loro lingua, con i consigli che daresti tu di persona.'],
  ['🔑', 'Host e affittacamere', 'Gestisci da remoto e i tuoi ospiti hanno comunque qualcuno che risponde.'],
  ['⛺', 'Campeggi e glamping', 'Chi è in piazzola chiede dal telefono e la richiesta arriva al reparto giusto.'],
  ['🏖️', 'Villaggi turistici', 'Un info point che sta nel telefono di ogni ospite.'],
  ['🏔️', 'Baite e rifugi', 'Coinvolgi lo staff solo quando serve davvero.'],
]

// reveal-on-scroll for the content sections
function useReveal() {
  const root = useRef()
  useEffect(() => {
    const els = root.current.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.15 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return root
}

export default function Sections() {
  const root = useReveal()
  return (
    <div className="content" ref={root}>
      <section id="funzioni" className="block">
        <div className="block__head reveal">
          <span className="kicker">Che cosa fa</span>
          <h2>Non solo risposte, <span className="grad grad--light">ma azioni.</span></h2>
          <p>ConSergio ascolta la richiesta dell’ospite, raccoglie tutti i dettagli e la passa alla persona giusta. Così ogni richiesta arriva allo staff già chiara, completa e pronta da gestire.</p>
        </div>
        <div className="verbs">
          {VERBS.map((v, i) => (
            <article className="glass verb reveal" style={{ '--d': `${i * 90}ms` }} key={v.title}>
              <span className="verb__icon">{v.icon}</span>
              <h3>{v.title}</h3>
              <p>{v.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="block stats reveal">
        {STATS.map(([n, u, d]) => (
          <div className="stat" key={u}>
            <b>{n}</b>
            <span>{u}</span>
            <small>{d}</small>
          </div>
        ))}
      </section>

      <section id="moduli" className="block">
        <div className="block__head reveal">
          <span className="kicker">Come è fatto</span>
          <h2>Due moduli, <span className="grad grad--light">un solo ConSergio.</span></h2>
          <p>Il Concierge è sempre incluso. Se vuoi gestire anche camere, disponibilità e prenotazioni, aggiungi Reservations quando ne hai bisogno.</p>
        </div>
        <div className="modules">
          <article className="glass module reveal">
            <span className="tag">Di serie, in ogni piano</span>
            <h3>Concierge</h3>
            <p>Parla con i tuoi ospiti e passa allo staff quello che va fatto di persona.</p>
            <ul>
              <li>Risponde in chat nella lingua dell’ospite, a ogni ora</li>
              <li>Catalogo dei servizi, prenotati dentro la conversazione</li>
              <li>La bacheca delle richieste per lo staff</li>
              <li>Lavora accanto al PMS o al gestionale che hai già</li>
            </ul>
          </article>
          <article className="glass module reveal" style={{ '--d': '120ms' }}>
            <span className="tag tag--alt">Si aggiunge al Concierge</span>
            <h3>Reservations</h3>
            <p>Per chi un gestionale non ce l’ha: camere e prenotazioni stanno in ConSergio.</p>
            <ul>
              <li>Calendario delle prenotazioni, camera per camera</li>
              <li>Tariffe per periodo e restrizioni di soggiorno</li>
              <li>Date occupate sui portali, importate via iCal</li>
              <li>Widget di prenotazione e assistente AI sul sito</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="block steps">
        <div className="block__head reveal">
          <span className="kicker">Come funziona</span>
          <h2>Cinque minuti per aprire l’account.</h2>
        </div>
        <ol className="steps__list">
          {[
            ['Configura la struttura', 'Ti registri da solo, aggiungi servizi, orari e informazioni. I documenti che hai già li carichi come sono.'],
            ['Stampa i QR in camera', 'Un QR per ogni camera o area comune, pronto da stampare. Niente hardware da installare.'],
            ['Gestisci tutto dalla dashboard', 'Richieste in tempo reale, conversazioni e statistiche su lingue e servizi più richiesti.'],
          ].map(([t, d], i) => (
            <li className="glass reveal" style={{ '--d': `${i * 110}ms` }} key={t}>
              <span className="steps__n">{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="per-chi" className="block">
        <div className="block__head reveal">
          <span className="kicker">Per chi è pensato</span>
          <h2>Che tu gestisca 3 stanze o 300.</h2>
        </div>
        <div className="who">
          {WHO.map(([i, t, d], k) => (
            <article className="glass who__item reveal" style={{ '--d': `${k * 70}ms` }} key={t}>
              <span>{i}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="block privacy reveal">
        <div className="glass privacy__box">
          <span className="privacy__flag">🇪🇺</span>
          <div>
            <span className="kicker">Dati e privacy</span>
            <h2>I dati dei tuoi ospiti restano in Unione Europea.</h2>
            <p>All’ospite che apre la chat non chiediamo nome, email o account. Contenuti, conversazioni e richieste stanno su server in UE, e firmiamo con te l’accordo sul trattamento dei dati.</p>
          </div>
        </div>
      </section>

      <section className="block cta reveal">
        <Picto className="cta__picto" />
        <h2>Il tuo concierge è pronto <span className="grad grad--light">in cinque minuti.</span></h2>
        <p>Basta un QR code per offrire ai tuoi ospiti un punto di riferimento sempre disponibile.</p>
        <div className="hero__cta">
          <a className="btn btn--primary btn--lg" href={SITE} target="_blank" rel="noreferrer">Attiva ora</a>
          <a className="btn btn--ghost btn--ghost-light btn--lg" href={`${SITE}`} target="_blank" rel="noreferrer">Guarda i piani</a>
        </div>
      </section>

      <footer className="foot">
        <Logo tone="light" className="foot__logo" />
        <p>ConSergio è un prodotto di DevInterface, software house di Bussolengo (VR).</p>
        <small>Scena 3D realizzata in Blender · Hotel Belvedere è una struttura immaginaria</small>
      </footer>
    </div>
  )
}

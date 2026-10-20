import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import QRCode from 'qrcode'
import { state, CHAT, range } from '../story'
import { Picto } from '../ui/Logo'

// Chat UI rendered on the 3D phone display (0.34 x 0.70 units -> 340 x 700 css px)
export default function PhoneScreen() {
  const root = useRef()
  const msgs = useRef([])
  const typing = useRef()
  const [qr, setQr] = useState('')

  useEffect(() => {
    QRCode.toDataURL('https://www.consergio.ai/it', { margin: 0, width: 220, color: { dark: '#0E2A22', light: '#ffffff' } }).then(setQr)
  }, [])

  useFrame(() => {
    const s = state.s
    const el = root.current
    if (!el) return
    const scanning = s < 0.758
    el.dataset.mode = scanning ? 'scan' : 'chat'
    el.dataset.found = s > 0.75 ? '1' : '0'
    let typingOn = false
    CHAT.forEach(([from, who], i) => {
      const m = msgs.current[i]
      if (!m) return
      const on = s >= from
      m.classList.toggle('on', on)
      // bot "typing…" right before each bot answer
      if (who !== 'guest' && s >= from - 0.01 && s < from) typingOn = true
    })
    typing.current.classList.toggle('on', typingOn)
    el.style.opacity = range(s, 0.72, 0.735) * (1 - range(s, 0.846, 0.858))
  })

  return (
    <Html transform distanceFactor={0.4} position={[0, 0, 0.027]} zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
      <div className="phone" ref={root} data-mode="scan">
        <div className="phone__status">
          <span>9:41</span>
          <span className="phone__icons">●●● ▲ ▮</span>
        </div>

        <div className="phone__scan">
          <div className="scan__frame">
            {qr && <img src={qr} alt="" />}
            <i className="scan__line" />
            <b className="c tl" /><b className="c tr" /><b className="c bl" /><b className="c br" />
          </div>
          <p className="scan__hint">Inquadra il QR in camera</p>
          <p className="scan__found">✓ Hotel Belvedere · Camera 101</p>
        </div>

        <div className="phone__chat">
          <header className="chat__head">
            <span className="chat__avatar"><Picto white /></span>
            <span>
              <strong>ConSergio</strong>
              <small>Online · risponde in 50+ lingue</small>
            </span>
            <span className="chat__lang">IT</span>
          </header>
          <div className="chat__body">
            <div className="chat__day">Hotel Belvedere · Camera 101</div>
            {CHAT.map(([, who, text], i) => (
              <div key={i} ref={(el) => (msgs.current[i] = el)} className={`msg msg--${who}`}>
                {who === 'ticket' ? (
                  <>
                    <span className="msg__tick">✓</span>
                    <span>{text}</span>
                  </>
                ) : (
                  text
                )}
              </div>
            ))}
            <div className="msg msg--typing" ref={typing}>
              <i /><i /><i />
            </div>
          </div>
          <footer className="chat__input">
            <span>Scrivi un messaggio…</span>
            <b>➤</b>
          </footer>
        </div>
      </div>
    </Html>
  )
}

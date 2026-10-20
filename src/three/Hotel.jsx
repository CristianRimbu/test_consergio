import * as THREE from 'three'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useGLTF, Html } from '@react-three/drei'
import {
  state, ACTORS, TAXI, DOORS, CUT, NIGHT, BUBBLES, B, sample, range, smooth, easeOut, lerp,
} from '../story'
import { makeQrCardTexture } from './qrTexture'
import PhoneScreen from './PhoneScreen'

const tmpA = []
const tmpB = []
const DAY_WIN = new THREE.Color('#d3ebe5')
const NIGHT_WIN = new THREE.Color('#ffe0a0')

function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export default function Hotel() {
  const { scene } = useGLTF('/models/hotel.glb', false, true)

  // ------------------------------------------------------------ one-time setup
  const rig = useMemo(() => {
    const byName = (n) => scene.getObjectByName(n)
    const mats = {}
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      const m = o.material
      mats[m.name] = m
      if (m.name === 'Glass' || m.name === 'Water') {
        m.transparent = true
        m.depthWrite = false
        m.opacity = m.name === 'Glass' ? 0.28 : 0.8
        o.castShadow = false
      }
      if (m.name === 'Cloud') o.castShadow = false
    })

    // façade materials are cloned so they can fade independently
    const facadeMats = { f0: [], f1: [] }
    for (const [key, name] of [['f0', 'Facade_F0'], ['f1', 'Facade_F1']]) {
      byName(name).traverse((o) => {
        if (!o.isMesh) return
        o.material = o.material.clone()
        o.material.transparent = true
        o.material.userData.baseOpacity = o.material.opacity
        facadeMats[key].push(o.material)
      })
    }

    // emissive materials
    const win = mats['Win_Glow']
    win.emissive = new THREE.Color('#ffbf5e')
    const lamp = mats['Lamp_Glow']
    lamp.emissive = new THREE.Color('#ffe2a6')
    const sign = mats['Sign_Glow']
    sign.emissive = new THREE.Color('#fff1cf')

    // reception monitor gets its own material so it can flash
    const screen = byName('Desk_Screen')
    screen.material = new THREE.MeshStandardMaterial({ color: '#0f3d2f', emissive: new THREE.Color('#2FAE7D'), emissiveIntensity: 0.4 })

    const actors = Object.keys(ACTORS).map((name) => {
      const node = byName(name)
      return { name, node, keys: ACTORS[name], rot: node.rotation.y, phase: 0, last: node.position.clone() }
    })
    const idle = ['Staff', 'Lounge_Guest'].map(byName)
    const orig = (n) => byName(n).position.clone()
    const nodes = {
      taxi: byName('Taxi'),
      wheels: [],
      f0: byName('Facade_F0'), f0p: orig('Facade_F0'),
      f1: byName('Facade_F1'), f1p: orig('Facade_F1'),
      doorL: byName('Door_L'), doorLp: orig('Door_L'),
      doorR: byName('Door_R'), doorRp: orig('Door_R'),
      e0L: byName('Elev0_DoorL'), e0Lp: orig('Elev0_DoorL'),
      e0R: byName('Elev0_DoorR'), e0Rp: orig('Elev0_DoorR'),
      e1L: byName('Elev1_DoorL'), e1Lp: orig('Elev1_DoorL'),
      e1R: byName('Elev1_DoorR'), e1Rp: orig('Elev1_DoorR'),
      room: byName('Room101_Door'),
      phone: byName('Phone'),
      display: byName('Phone_Display'),
      qr: byName('QR_Stand'),
      qrCode: byName('QR_Code'),
      bell: byName('Desk_Bell'),
      clouds: [0, 1, 2, 3].map((i) => byName(`Cloud_${i}`)),
      staff: byName('Staff'),
      screen,
    }
    nodes.taxi.traverse((o) => o.name.startsWith('Taxi_Wheel') && nodes.wheels.push(o))
    nodes.clouds.forEach((c) => (c.userData.x = c.position.x))
    nodes.phone.visible = false
    return { mats, facadeMats, actors, idle, nodes, win, lamp, sign }
  }, [scene])

  // QR card texture (async: waits for the Ubuntu font)
  useEffect(() => {
    let alive = true
    makeQrCardTexture().then((tex) => {
      if (!alive) return
      rig.nodes.qrCode.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    })
    return () => (alive = false)
  }, [rig])

  const bubbleRefs = useRef([])
  const qrGlow = useRef()

  // ------------------------------------------------------------ per-frame story
  useFrame(({ clock }, dt) => {
    const s = state.s
    const t = clock.elapsedTime
    const { nodes, actors, facadeMats } = rig

    // actors walk along their tracks
    for (const a of actors) {
      const p = sample(a.keys, s, tmpA)
      const [x, y, z, vis, face] = p
      const [tx, ty, tz] = B(x, y, z)
      a.node.visible = vis > 0.5
      // facing: direction of travel, or the explicit angle when standing still
      const ahead = sample(a.keys, s + 0.004, tmpB)
      const dx = ahead[0] - x, dy = ahead[1] - y
      let target = a.rot
      if (Math.hypot(dx, dy) > 0.02) target = Math.atan2(dx, -dy)
      else if (!Number.isNaN(face)) target = face
      a.rot += angleDelta(a.rot, target) * Math.min(1, dt * 10)
      a.node.rotation.y = a.rot
      // walk bob
      const moved = Math.hypot(tx - a.last.x, tz - a.last.z)
      a.phase += moved * 9
      const bob = moved > 0.0005 ? Math.abs(Math.sin(a.phase)) * 0.09 : 0
      a.node.position.set(tx, ty + bob, tz)
      a.node.rotation.z = moved > 0.0005 ? Math.sin(a.phase) * 0.06 : a.node.rotation.z * 0.9
      a.last.set(tx, ty, tz)
    }

    // idle breathing + stressed receptionist
    rig.idle.forEach((n, i) => {
      n.scale.y = 1 + Math.sin(t * 2 + i) * 0.015
    })
    const stress = range(s, 0.24, 0.26) * (1 - range(s, 0.38, 0.4))
    nodes.staff.rotation.z = Math.sin(t * 28) * 0.05 * stress
    nodes.staff.position.y = 0.1 + Math.abs(Math.sin(t * 9)) * 0.08 * stress
    nodes.bell.position.y = 0.1 + 1.18 + Math.abs(Math.sin(t * 16)) * 0.04 * stress

    // taxi
    const tx = sample(TAXI, s, tmpA)[0]
    const dx = tx - nodes.taxi.position.x
    nodes.taxi.position.x = tx
    nodes.taxi.visible = tx > -25.5 && tx < 27.5
    nodes.wheels.forEach((w) => w.rotateY(-dx / 0.3))

    // façades
    const c0 = sample(CUT.f0, s, tmpA)[0]
    nodes.f0.position.y = nodes.f0p.y - smooth(c0) * 3.8
    nodes.f0.visible = c0 < 0.999
    facadeMats.f0.forEach((m) => (m.opacity = m.userData.baseOpacity * (1 - range(c0, 0.6, 1))))
    const c1 = sample(CUT.f1, s, tmpA)[0]
    nodes.f1.position.z = nodes.f1p.z + smooth(c1) * 3.0
    nodes.f1.visible = c1 < 0.999
    facadeMats.f1.forEach((m) => {
      m.opacity = 1 - c1
      m.depthWrite = c1 < 0.05
    })

    // entrance doors slide open and drop with the façade
    const de = sample(DOORS.entrance, s, tmpA)[0]
    for (const [n, p, sgn] of [[nodes.doorL, nodes.doorLp, -1], [nodes.doorR, nodes.doorRp, 1]]) {
      n.position.set(p.x + sgn * de * 1.05, p.y - smooth(c0) * 3.8, p.z)
      n.visible = c0 < 0.999
    }
    // elevator doors (telescopic)
    const elev = (L, Lp, R, Rp, o) => {
      const k = 0.92 * smooth(o)
      L.scale.x = 1 - k
      L.position.x = Lp.x - 0.425 * k
      R.scale.x = 1 - k
      R.position.x = Rp.x + 0.425 * k
    }
    elev(nodes.e0L, nodes.e0Lp, nodes.e0R, nodes.e0Rp, sample(DOORS.elev0, s, tmpA)[0])
    elev(nodes.e1L, nodes.e1Lp, nodes.e1R, nodes.e1Rp, sample(DOORS.elev1, s, tmpA)[0])
    nodes.room.rotation.y = smooth(sample(DOORS.room, s, tmpA)[0]) * 1.7

    // QR stand pulses when the camera gets close
    const qrOn = range(s, 0.64, 0.7) * (1 - range(s, 0.86, 0.9))
    nodes.qr.scale.setScalar(1 + qrOn * 0.12 * (0.5 + 0.5 * Math.sin(t * 3)))
    if (qrGlow.current) qrGlow.current.intensity = qrOn * 3 + (state.night || 0) * 1.2

    // reception monitor flashes when the ticket lands
    const land = range(s, 0.885, 0.895) * (1 - range(s, 0.93, 0.95))
    nodes.screen.material.emissiveIntensity = 0.4 + land * (2.5 + Math.sin(t * 10) * 0.8)

    // phone: rises in front of the QR, then drops away
    const up = easeOut(range(s, 0.722, 0.752))
    const down = range(s, 0.848, 0.872)
    const mobile = state.aspect < 0.9
    nodes.phone.visible = s > 0.72 && s < 0.874
    const [px, py, pz] = B(mobile ? -2.35 : -2.1, 3.56, (mobile ? 5.06 : 4.98) - (1 - up) * 0.9 - down * 1.2)
    nodes.phone.position.set(px, py, pz)
    nodes.phone.rotation.x = -(1 - up) * 0.6 + down * 0.5
    nodes.phone.rotation.y = Math.sin(t * 0.8) * 0.03

    // clouds drift
    nodes.clouds.forEach((c, i) => {
      c.position.x = c.userData.x + Math.sin(t * 0.05 + i * 2) * 3
    })

    // night lighting
    const night = sample(NIGHT, s, tmpA)[0]
    state.night = night
    rig.win.color.copy(DAY_WIN).lerp(NIGHT_WIN, night)
    rig.win.emissiveIntensity = night * 2.2
    rig.lamp.emissiveIntensity = 0.5 + night * 2.2
    rig.sign.emissiveIntensity = night * 4

    // speech bubbles
    BUBBLES.forEach(([who, , from, to], i) => {
      const el = bubbleRefs.current[i]
      if (!el) return
      const o = range(s, from, from + 0.008) * (1 - range(s, to - 0.006, to))
      el.style.opacity = o
      el.style.transform = `translate(-50%, -100%) scale(${0.6 + 0.4 * o})`
    })
  })

  // bubble anchors follow the actors (rendered as children of the actor nodes)
  const bubbleNodes = useMemo(() => BUBBLES.map(([who]) => scene.getObjectByName(who)), [scene])

  return (
    <>
      <primitive object={scene} />
      {createPortal(<PhoneScreen />, rig.nodes.phone)}
      <pointLight
        ref={qrGlow}
        position={B(-2.1, 4.3, 5.0)}
        color="#2FAE7D"
        intensity={0}
        distance={3}
        decay={1.5}
      />
      {BUBBLES.map(([who, text], i) => (
        <Fragment key={i}>
          {createPortal(
          <Html position={[0, 2.0 + (i % 3) * 0.32, 0]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
            <div className={`bubble ${who === 'Staff' ? 'bubble--staff' : ''}`} ref={(el) => (bubbleRefs.current[i] = el)}>
              {text}
            </div>
          </Html>,
          bubbleNodes[i],
          )}
        </Fragment>
      ))}
    </>
  )
}

useGLTF.preload('/models/hotel.glb', false, true)

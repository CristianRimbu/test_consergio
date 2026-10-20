import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail } from '@react-three/drei'
import { state, B, TICKET, TICKET_PTS, range, easeInOut } from '../story'
import { makeTicketTexture } from './qrTexture'

// request card that flies from the guest's phone (room 101) to the reception monitor
export const ticketCurve = new THREE.CubicBezierCurve3(...TICKET_PTS.map((p) => new THREE.Vector3(...B(...p))))

export default function Ticket() {
  const mesh = useRef()
  const tex = useMemo(() => makeTicketTexture(), [])

  useFrame(({ camera, clock }) => {
    const m = mesh.current
    if (!m) return
    const k = range(state.s, TICKET[0], TICKET[1])
    m.visible = k > 0 && k < 1
    ticketCurve.getPoint(easeInOut(k), m.position)
    m.quaternion.copy(camera.quaternion)
    m.rotateZ(Math.sin(clock.elapsedTime * 6) * 0.08)
    const sc = 0.55 + Math.sin(Math.PI * k) * 0.6 - k * 0.25
    m.scale.setScalar(Math.max(0.001, sc))
  })

  return (
    <Trail width={2.6} length={8} color="#2FAE7D" attenuation={(w) => w * w} decay={1.5}>
      <mesh ref={mesh} visible={false}>
        <planeGeometry args={[1.3, 0.715]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </Trail>
  )
}

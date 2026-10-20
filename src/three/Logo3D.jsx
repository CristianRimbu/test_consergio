import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { state, B, range, easeInOut, easeOut, lerp } from '../story'

const v = new THREE.Vector3()
const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const heroPos = new THREE.Vector3()
const WINDOW = new THREE.Vector3(...B(-2.4, -5.8, 5.6)) // room 101 window
const NIGHT_POS = new THREE.Vector3(...B(0, -3, 16.2))

const backOut = (t) => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export default function Logo3D() {
  const { scene } = useGLTF('/models/logo.glb', false, true)
  const camera = useThree((s) => s.camera)
  const group = useRef()
  const light = useRef()
  const born = useRef(null)

  const parts = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: new THREE.Color('#2FAE7D'),
      emissiveIntensity: 0,
    })
    const get = (n) => scene.getObjectByName(n)
    const p = { baffo: get('Logo_Baffo'), sx: get('Logo_TestaSx'), dx: get('Logo_TestaDx'), mat }
    for (const o of [p.baffo, p.sx, p.dx]) {
      o.material = mat
      o.castShadow = true
      o.userData.y = o.position.y
    }
    return p
  }, [scene])

  useFrame(({ clock, size }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    if (born.current === null) born.current = t
    const intro = Math.min(1, (t - born.current) / 1.4)
    const s = state.s
    const aspect = size.width / size.height
    const [px, py] = state.pointer

    // hero placement relative to the camera, so it frames well on any screen
    camera.getWorldDirection(fwd)
    right.crossVectors(fwd, camera.up).normalize()
    up.crossVectors(right, fwd).normalize()
    const dist = 14
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist
    const halfW = halfH * aspect
    const wide = aspect > 1
    const heroScale = wide ? Math.min(2.7, halfW * 0.3) : Math.min(2.2, halfW * 0.4)
    heroPos
      .copy(camera.position)
      .addScaledVector(fwd, dist)
      .addScaledVector(right, wide ? halfW * 0.44 : 0)
      .addScaledVector(up, wide ? 0.2 : halfH * 0.42)

    // phase 1: hero  ->  phase 2: dive into room 101  ->  phase 3: hidden  ->  phase 4: night sky
    const fly = easeInOut(range(s, 0.035, 0.12))
    const night = easeOut(range(s, 0.955, 0.995))
    let scale
    if (night > 0) {
      v.copy(NIGHT_POS)
      v.y += lerp(-6, 0, night) + Math.sin(t * 1.2) * 0.25
      scale = 1.9 * night
      g.rotation.set(0, Math.sin(t * 0.6) * 0.25, 0)
    } else {
      // bezier: hero -> high arc -> window
      const c = v.copy(heroPos).lerp(WINDOW, 0.5)
      c.y += 6
      const a = 1 - fly
      v.set(
        a * a * heroPos.x + 2 * a * fly * c.x + fly * fly * WINDOW.x,
        a * a * heroPos.y + 2 * a * fly * c.y + fly * fly * WINDOW.y,
        a * a * heroPos.z + 2 * a * fly * c.z + fly * fly * WINDOW.z,
      )
      scale = lerp(heroScale * backOut(intro), 0.05, fly)
      // face the camera in the hero, spin while flying
      g.quaternion.copy(camera.quaternion)
      g.rotateY(px * 0.45 * (1 - fly) + fly * Math.PI * 2)
      g.rotateX(-py * 0.25 * (1 - fly))
      g.rotateZ(Math.sin(t * 0.7) * 0.03)
      v.y += Math.sin(t * 1.4) * 0.12 * (1 - fly)
    }
    g.position.copy(v)
    g.scale.setScalar(Math.max(scale, 0.0001))
    g.visible = fly < 0.995 || night > 0

    // heads bounce, moustache "smiles"
    const drop = (k) => (1 - backOut(Math.min(1, Math.max(0, (t - born.current - k) / 0.9)))) * 1.8
    parts.sx.position.y = parts.sx.userData.y + Math.abs(Math.sin(t * 2.2)) * 0.06 + drop(0.15)
    parts.dx.position.y = parts.dx.userData.y + Math.abs(Math.sin(t * 2.2 + 0.9)) * 0.06 + drop(0.35)
    parts.baffo.scale.set(1 + Math.sin(t * 2.2) * 0.025, 1 - Math.sin(t * 2.2) * 0.02, 1)

    parts.mat.emissiveIntensity = (state.night || 0) * 0.55 + fly * 0.8
    if (light.current) {
      light.current.position.copy(g.position)
      light.current.intensity = fly * (1 - fly) * 60 + night * 25
    }
  })

  return (
    <>
      <group ref={group}>
        <primitive object={scene} />
      </group>
      <pointLight ref={light} color="#5fd3a4" distance={10} decay={1.6} intensity={0} />
    </>
  )
}

useGLTF.preload('/models/logo.glb', false, true)

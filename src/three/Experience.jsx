import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { state, CAMERA, TICKET, B, sample, clamp, lerp, range, easeInOut } from '../story'
import Hotel from './Hotel'
import Logo3D from './Logo3D'
import Ticket, { ticketCurve } from './Ticket'

const cam = []
const pos = new THREE.Vector3()
const look = new THREE.Vector3()
const curLook = new THREE.Vector3()
const right = new THREE.Vector3()
const tick = new THREE.Vector3()

// sky colours (top, bottom) day -> dusk -> night
const SKY = {
  dayTop: new THREE.Color('#cfe9dc'), dayBot: new THREE.Color('#f2f9f6'),
  duskTop: new THREE.Color('#2a6b5c'), duskBot: new THREE.Color('#f6c99a'),
  nightTop: new THREE.Color('#041611'), nightBot: new THREE.Color('#0d3a2e'),
}
const top = new THREE.Color()
const bot = new THREE.Color()
const skyUniforms = {
  top: { value: new THREE.Color('#cfe9dc') },
  bot: { value: new THREE.Color('#f2f9f6') },
}

function Sky() {
  return (
    <mesh scale={400} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={skyUniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`}
        fragmentShader={`uniform vec3 top; uniform vec3 bot; varying vec3 vP;
          void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.25, 0., 1.); gl_FragColor = vec4(mix(bot, top, smoothstep(0.,1.,h)), 1.);
          #include <colorspace_fragment>
          }`}
      />
    </mesh>
  )
}

function DevHandles() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene })
  return null
}

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const first = useRef(true)

  useFrame((_, dt) => {
    // damp the scroll progress for buttery motion
    state.s += (state.target - state.s) * Math.min(1, dt * 4.5)
    if (Math.abs(state.target - state.s) < 1e-5) state.s = state.target
    const aspect = size.width / size.height
    state.aspect = aspect

    sample(CAMERA, state.s, cam)
    pos.set(...B(cam[0], cam[1], cam[2]))
    look.set(...B(cam[3], cam[4], cam[5]))
    // follow the request ticket while it flies down to the reception
    const follow = range(state.s, 0.85, 0.86) * (1 - range(state.s, 0.882, 0.894))
    if (follow > 0) {
      ticketCurve.getPoint(easeInOut(range(state.s, TICKET[0], TICKET[1])), tick)
      look.lerp(tick, follow * 0.85)
    }
    // portrait: keep the night hotel centred (desktop frames it to the right of the text)
    if (aspect < 1) look.x *= 1 - range(state.s, 0.94, 0.975)

    // after the story the camera slowly orbits the hotel at night
    if (state.s >= 0.999 && state.after > 0) {
      const a = state.after * 1.6
      const r = Math.hypot(pos.x, pos.z)
      const base = Math.atan2(pos.x, pos.z)
      pos.x = Math.sin(base + a) * r
      pos.z = Math.cos(base + a) * r
      pos.y += state.after * 6
    }

    // gentle parallax with the pointer
    right.subVectors(look, pos).cross(camera.up).normalize()
    const par = clamp(pos.distanceTo(look) / 30, 0.05, 1)
    pos.addScaledVector(right, state.pointer[0] * 0.9 * par)
    pos.y += state.pointer[1] * 0.5 * par

    // portrait screens: widen the vertical fov so the scene still fits horizontally
    const fit = aspect < 1.3 ? Math.min(1.3 / aspect, 2.1) : 1
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam[6] / 2)) * Math.pow(fit, 0.75)))

    if (first.current) {
      camera.position.copy(pos)
      curLook.copy(look)
      first.current = false
    }
    camera.position.lerp(pos, Math.min(1, dt * 8))
    curLook.lerp(look, Math.min(1, dt * 8))
    camera.lookAt(curLook)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 8))
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function Lights() {
  const sun = useRef()
  const hemi = useRef()
  const lobby = useRef()
  const room = useRef()
  const street = useRef()
  const moon = useRef()
  const stars = useRef()
  const dayC = useMemo(() => new THREE.Color('#fff4e0'), [])
  const nightC = useMemo(() => new THREE.Color('#9fb8ff'), [])
  const root = document.documentElement
  const scene = useThree((s) => s.scene)

  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 1400
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.random() * Math.PI * 0.42
      const r = 150
      p[i * 3] = Math.sin(ph) * Math.cos(th) * r
      p[i * 3 + 1] = Math.cos(ph) * r * 0.8 + 10
      p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])

  useFrame(() => {
    const n = state.night || 0
    const dusk = Math.sin(Math.min(1, n * 1.6) * Math.PI) // peaks while the sun sets
    sun.current.intensity = lerp(2.6, 0.55, n)
    sun.current.color.copy(dayC).lerp(nightC, n)
    sun.current.position.set(...B(lerp(22, -26, n), lerp(-24, 18, n), lerp(34, 40, n)))
    hemi.current.intensity = lerp(1.25, 0.32, n)
    lobby.current.intensity = 6 + n * 22
    room.current.intensity = 3 + n * 16
    street.current.intensity = n * 30
    moon.current.visible = n > 0.05
    moon.current.material.opacity = n
    stars.current.material.opacity = Math.max(0, n * 1.2 - 0.2)

    top.copy(SKY.dayTop).lerp(SKY.duskTop, dusk * 0.6).lerp(SKY.nightTop, n)
    bot.copy(SKY.dayBot).lerp(SKY.duskBot, dusk * 0.7).lerp(SKY.nightBot, n)
    skyUniforms.top.value.copy(top)
    skyUniforms.bot.value.copy(bot)
    if (scene.fog) scene.fog.color.copy(bot)
    root.style.setProperty('--sky-top', `#${top.getHexString()}`)
    root.style.setProperty('--sky-bot', `#${bot.getHexString()}`)
    root.dataset.night = n > 0.5 ? '1' : '0'
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#a6d9bc', 1.25]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={sun}
        castShadow
        intensity={2.6}
        position={B(22, -24, 34)}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <pointLight ref={lobby} position={B(-2, -0.5, 3.0)} color="#ffd9a0" distance={14} decay={1.6} />
      <pointLight ref={room} position={B(-3.8, 0.5, 6.7)} color="#ffd9a0" distance={10} decay={1.6} />
      <pointLight ref={street} position={B(0, -8, 4)} color="#ffcf8a" distance={22} decay={1.5} />
      <mesh ref={moon} position={B(-30, 70, 38)}>
        <sphereGeometry args={[3, 32, 16]} />
        <meshBasicMaterial color="#fff6dc" transparent toneMapped={false} fog={false} />
      </mesh>
      <points ref={stars} geometry={starGeo}>
        <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
      </points>
    </>
  )
}

export default function Experience() {
  return (
    <>
      <DevHandles />
      <CameraRig />
      <Sky />
      <fog attach="fog" args={['#f2f9f6', 70, 220]} />
      <Lights />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 8, 12]} scale={[24, 6, 1]} color="#ffffff" />
        <Lightformer intensity={1.2} position={[-14, 4, 0]} rotation-y={Math.PI / 2} scale={[20, 4, 1]} color="#dcefe5" />
        <Lightformer intensity={1.6} position={[14, 6, -4]} rotation-y={-Math.PI / 2} scale={[16, 6, 1]} color="#2FAE7D" />
        <Lightformer intensity={0.8} position={[0, -6, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} color="#0E5C45" />
      </Environment>
      <Hotel />
      <Logo3D />
      <Ticket />
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />
        <Vignette offset={0.3} darkness={0.35} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </>
  )
}

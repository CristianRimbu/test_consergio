import { Suspense, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import Lenis from 'lenis'
import { state, clamp } from './story'
import Experience from './three/Experience'
import { Header, Loader, Hero, Captions, Finale, Dashboard, Rail } from './ui/Overlay'
import Sections from './ui/Sections'

export default function App() {
  const lenis = useRef()

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const l = new Lenis({ lerp: reduce ? 1 : 0.09, wheelMultiplier: 0.85 })
    lenis.current = l
    if (import.meta.env.DEV) Object.assign(window, { __lenis: l, __state: state })
    let raf
    const loop = (t) => {
      l.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const update = () => {
      const story = document.getElementById('storia')
      const total = story.offsetHeight - window.innerHeight
      const y = window.scrollY
      state.target = clamp((y - story.offsetTop) / total)
      const end = story.offsetTop + total
      const rest = document.documentElement.scrollHeight - window.innerHeight - end
      state.after = clamp((y - end) / Math.max(1, rest))
    }
    const move = (e) => {
      state.pointer[0] = (e.clientX / window.innerWidth) * 2 - 1
      state.pointer[1] = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    l.on('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('pointermove', move, { passive: true })
    update()
    return () => {
      cancelAnimationFrame(raf)
      l.destroy()
      window.removeEventListener('resize', update)
      window.removeEventListener('pointermove', move)
    }
  }, [])

  // jump to a point of the story (0..1)
  const nav = useCallback((at) => {
    const story = document.getElementById('storia')
    const y = story.offsetTop + at * (story.offsetHeight - window.innerHeight)
    lenis.current?.scrollTo(y, { duration: 2.4 })
  }, [])

  return (
    <>
      <div className="stage">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: 38, near: 0.1, far: 600, position: [0, 14, 34] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </Canvas>
      </div>

      <Header onNav={nav} />
      <Hero onNav={nav} />
      <Captions />
      <Dashboard />
      <Finale onNav={nav} />
      <Rail onNav={nav} />
      <Loader />

      <main>
        <div id="storia" className="story" aria-hidden="true" />
        <Sections />
      </main>
    </>
  )
}

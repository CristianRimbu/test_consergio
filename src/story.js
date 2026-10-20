// The whole landing story is a pure function of the scroll progress `s` (0..1).
// Every position here is written in Blender coordinates (Z up, hotel front facing -Y),
// exactly as in blender/build_hotel.py, and converted with B() to three.js (Y up).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const range = (s, a, b) => clamp((s - a) / (b - a))
export const smooth = (t) => t * t * (3 - 2 * t)
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOut = (t) => 1 - Math.pow(1 - t, 3)
export const lerp = (a, b, t) => a + (b - a) * t
export const B = (x, y, z) => [x, z, -y]

// shared mutable state, read inside the render loop (no React re-renders)
export const state = {
  target: 0, // story progress from the scroll position
  s: 0, // damped story progress
  after: 0, // progress through the content below the story (0..1)
  pointer: [0, 0],
  aspect: 1,
}

// chapters shown in the side rail and used by captions
export const CHAPTERS = [
  { id: 'hero', label: 'ConSergio', at: 0 },
  { id: 'arrive', label: 'Arrivo', at: 0.135 },
  { id: 'lobby', label: 'Reception', at: 0.3 },
  { id: 'lift', label: 'Check-in', at: 0.45 },
  { id: 'room', label: 'Camera 101', at: 0.6 },
  { id: 'chat', label: 'Chat', at: 0.79 },
  { id: 'staff', label: 'Staff', at: 0.91 },
  { id: 'night', label: 'Notte', at: 0.995 },
]

// ------------------------------------------------------------------ keyframe tracks
// keys: [[s, v1, v2, ...], ...]  -> values interpolated with smoothstep between keys
export function sample(keys, s, out = []) {
  const n = keys[0].length - 1
  out.length = n
  let a = keys[0]
  let b = keys[0]
  let t = 0
  if (s >= keys[keys.length - 1][0]) a = b = keys[keys.length - 1]
  else if (s > keys[0][0]) {
    for (let i = 0; i < keys.length - 1; i++) {
      if (s >= keys[i][0] && s <= keys[i + 1][0]) {
        a = keys[i]
        b = keys[i + 1]
        t = smooth((s - a[0]) / (b[0] - a[0] || 1))
        break
      }
    }
  }
  for (let k = 1; k <= n; k++) out[k - 1] = a[k] + (b[k] - a[k]) * t
  return out
}

// ------------------------------------------------------------------ camera
// [s, posX, posY, posZ, lookX, lookY, lookZ, fov]   (Blender coords)
export const CAMERA = [
  [0.0, 0, -50, 18.5, 0, -30, 17.6, 36],
  [0.04, 0, -49, 19, 0, -26, 15.5, 36],
  [0.1, 7, -42, 21, 0, -3, 5.5, 38],
  [0.15, 15, -31, 11, 0, -6, 2.5, 38],
  [0.2, 7.5, -19, 5.5, -0.5, -6, 1.6, 40],
  [0.235, 4.2, -8.2, 2.6, -1.5, -2.0, 1.3, 44],
  [0.262, 1.4, -4.9, 2.85, -1.9, 1.4, 1.35, 48],
  [0.33, 1.0, -4.7, 2.9, -2.1, 1.6, 1.35, 48],
  [0.385, 0.6, -4.4, 2.8, -2.4, 1.8, 1.35, 48],
  [0.43, -1.5, -4.6, 3.3, 5.6, 2.4, 1.4, 48],
  [0.475, 0.4, -4.8, 3.2, 6.2, 2.6, 1.8, 46],
  [0.497, 3.6, -7.6, 2.5, 5.2, 1.8, 3.2, 44],
  [0.53, 5.5, -12.5, 7.4, 5.4, 2.0, 5.0, 40],
  [0.555, 3.5, -8.5, 6.6, 5.2, 2.4, 4.9, 42],
  [0.59, -1.2, -8.8, 7.0, 0.2, 1.0, 4.9, 42],
  [0.63, -0.9, -4.2, 6.5, -2.4, 2.8, 4.6, 44],
  [0.7, -2.15, 2.4, 5.35, -2.1, 4.75, 4.95, 40],
  [0.745, -2.3, 1.9, 5.15, -2.35, 3.6, 4.98, 40],
  [0.84, -2.3, 1.9, 5.15, -2.35, 3.6, 4.98, 40],
  [0.862, -1.0, -6.0, 7.2, -1.6, -2.0, 5.4, 42],
  [0.874, 9.0, -10.0, 5.0, -1.2, -2.5, 3.2, 42],
  [0.889, 7.0, -8.6, 2.6, -1.8, -0.5, 1.8, 44],
  [0.905, 1.2, -4.4, 2.75, -3.3, 2.4, 1.5, 40],
  [0.94, 2.2, -6.8, 3.4, -2.6, 1.8, 1.6, 40],
  [0.975, 0, -40, 13, -7.5, 0, 7.4, 38],
  [1.0, -5, -37, 12, -8.5, 0, 7.6, 38],
]

// ------------------------------------------------------------------ actors
// [s, x, y, z, visible(0/1), face (radians or NaN = face movement)]
const N = NaN
const Z0 = 0.1 // lobby floor
const ZS = 0.14 // sidewalk
const Z1 = 3.85 // room floor

// queue slots in front of the reception desk
const S0 = [-3.5, 0.9]
const S1 = [-3.4, -0.4]
const S2 = [-3.5, -1.7]
const S3 = [-3.4, -3.0]
const S4 = [-3.6, -4.3]
const T1 = 0.3, T2 = 0.325, T3 = 0.35, T4 = 0.372
const STEP = 0.012

const k = (s, xy, z = Z0, vis = 1, face = N) => [s, xy[0], xy[1], z, vis, face]

export const ACTORS = {
  Guest_A: [
    k(0.0, [-0.6, -9.6], ZS, 0),
    k(0.163, [-0.6, -9.0], ZS, 0),
    k(0.165, [-0.6, -8.6], ZS, 1),
    k(0.18, [-0.6, -7.4], ZS),
    k(0.215, [-0.4, -5.7], ZS),
    k(0.235, [-1.2, -4.6]),
    k(0.26, S4.map((v, i) => v - (i ? 0 : 0.2))),
    k(T1, S4.map((v, i) => v - (i ? 0 : 0.2))), k(T1 + STEP, [S3[0] - 0.4, S3[1]]),
    k(T2, [S3[0] - 0.4, S3[1]]), k(T2 + STEP, [S2[0] - 0.4, S2[1]]),
    k(T3, [S2[0] - 0.4, S2[1]]), k(T3 + STEP, [S1[0] - 0.4, S1[1]]),
    k(T4, [S1[0] - 0.4, S1[1]]), k(T4 + STEP, [-3.9, 0.9], Z0, 1, 0),
    k(0.415, [-3.9, 0.9], Z0, 1, 0),
    k(0.44, [1.5, 1.3]),
    k(0.462, [5.75, 1.7]),
    k(0.478, [5.75, 3.7], Z0, 1, 0),
    k(0.5, [5.75, 3.7], Z0, 1, 0),
    k(0.501, [5.75, 3.7], Z1, 1, 0),
    k(0.555, [5.75, 3.7], Z1, 1, 0),
    k(0.57, [5.6, 1.0], Z1),
    k(0.588, [1.0, 1.0], Z1),
    k(0.603, [-0.9, 1.0], Z1),
    k(0.62, [-1.0, 2.6], Z1),
    k(0.64, [-0.95, 3.75], Z1, 1, -2.2),
    k(0.94, [-0.95, 3.75], Z1, 1, -2.2),
  ],
  Guest_B: [
    k(0.0, [0.6, -9.6], ZS, 0),
    k(0.168, [0.6, -9.0], ZS, 0),
    k(0.17, [0.6, -8.6], ZS, 1),
    k(0.185, [0.6, -7.4], ZS),
    k(0.22, [0.4, -5.7], ZS),
    k(0.24, [-0.6, -4.7]),
    k(0.265, S4.map((v, i) => v + (i ? -0.1 : 0.75))),
    k(T1, S4.map((v, i) => v + (i ? -0.1 : 0.75))), k(T1 + STEP, [S3[0] + 0.6, S3[1]]),
    k(T2, [S3[0] + 0.6, S3[1]]), k(T2 + STEP, [S2[0] + 0.6, S2[1]]),
    k(T3, [S2[0] + 0.6, S2[1]]), k(T3 + STEP, [S1[0] + 0.6, S1[1]]),
    k(T4, [S1[0] + 0.6, S1[1]]), k(T4 + STEP, [-2.8, 0.9], Z0, 1, 0),
    k(0.418, [-2.8, 0.9], Z0, 1, 0),
    k(0.442, [2.2, 1.0]),
    k(0.465, [6.6, 1.7]),
    k(0.48, [6.6, 3.9], Z0, 1, 0),
    k(0.5, [6.6, 3.9], Z0, 1, 0),
    k(0.501, [6.6, 3.9], Z1, 1, 0),
    k(0.558, [6.6, 3.9], Z1, 1, 0),
    k(0.574, [6.4, 0.6], Z1),
    k(0.592, [1.0, 0.6], Z1),
    k(0.608, [-0.9, 0.6], Z1),
    k(0.63, [-3.9, 1.7], Z1),
    k(0.65, [-4.0, 1.9], Z1, 1, 0.5),
    k(0.94, [-4.0, 1.9], Z1, 1, 0.5),
  ],
  Queue_1: [
    k(0, S0, Z0, 1, 0), k(T1, S0, Z0, 1, 0),
    k(T1 + 0.015, [-1.2, -2.6]), k(T1 + 0.028, [0.3, -5.2]), k(T1 + 0.036, [0.8, -6.6], ZS),
    k(T1 + 0.066, [9, -7.0], ZS), k(T1 + 0.1, [17, -7.0], ZS, 1), k(T1 + 0.101, [17, -7.0], ZS, 0),
  ],
  Queue_2: [
    k(0, S1, Z0, 1, 0), k(T1, S1, Z0, 1, 0), k(T1 + STEP, S0, Z0, 1, 0), k(T2, S0, Z0, 1, 0),
    k(T2 + 0.015, [-1.2, -3.0]), k(T2 + 0.03, [0.3, -5.2]), k(T2 + 0.04, [0.6, -6.6], ZS),
    k(T2 + 0.07, [9, -7.3], ZS), k(T2 + 0.1, [17, -7.3], ZS, 1), k(T2 + 0.101, [17, -7.3], ZS, 0),
  ],
  Queue_3: [
    k(0, S2, Z0, 1, 0), k(T1, S2, Z0, 1, 0), k(T1 + STEP, S1, Z0, 1, 0), k(T2, S1, Z0, 1, 0),
    k(T2 + STEP, S0, Z0, 1, 0), k(T3, S0, Z0, 1, 0),
    k(T3 + 0.012, [-1.4, -2.8]), k(T3 + 0.024, [-0.2, -5.2]), k(T3 + 0.032, [-0.9, -6.6], ZS),
    k(T3 + 0.06, [-9, -7.0], ZS), k(T3 + 0.09, [-17, -7.0], ZS, 1), k(T3 + 0.091, [-17, -7.0], ZS, 0),
  ],
  Queue_4: [
    k(0, S3, Z0, 1, 0), k(T1, S3, Z0, 1, 0), k(T1 + STEP, S2, Z0, 1, 0), k(T2, S2, Z0, 1, 0),
    k(T2 + STEP, S1, Z0, 1, 0), k(T3, S1, Z0, 1, 0), k(T3 + STEP, S0, Z0, 1, 0), k(T4, S0, Z0, 1, 0),
    k(T4 + 0.012, [-2.0, -2.6]), k(T4 + 0.024, [-0.3, -5.2]), k(T4 + 0.032, [-0.6, -6.6], ZS),
    k(T4 + 0.06, [-9, -7.4], ZS), k(T4 + 0.09, [-17, -7.4], ZS, 1), k(T4 + 0.091, [-17, -7.4], ZS, 0),
  ],
  Staff_2: [
    k(0, [-1.9, 3.3], Z0, 1, 0), k(0.9, [-1.9, 3.3], Z0, 1, 0), k(0.912, [-0.6, 3.6], Z0, 1, N),
    k(0.925, [-0.6, 1.4]), k(0.94, [5.8, 1.5]), k(0.952, [5.8, 3.7], Z0, 1, 0), k(0.97, [5.8, 3.7], Z0, 0, 0),
  ],
}

// ------------------------------------------------------------------ props
export const TAXI = [
  [0.0, -26],
  [0.1, -26],
  [0.158, 0],
  [0.19, 0],
  [0.25, 28],
]

// door open amounts 0..1
export const DOORS = {
  entrance: [[0.2, 0], [0.21, 1], [0.95, 1], [0.97, 0]],
  elev0: [[0.44, 0], [0.455, 1], [0.483, 1], [0.497, 0], [0.932, 0], [0.944, 1], [0.955, 1], [0.966, 0]],
  elev1: [[0.54, 0], [0.553, 1], [0.578, 1], [0.592, 0]],
  room: [[0.578, 0], [0.592, 1], [0.625, 1], [0.645, 0]],
}

// cut-away of the façades (0 = in place, 1 = removed)
export const CUT = {
  f0: [[0.19, 0], [0.235, 1], [0.95, 1], [0.975, 0]],
  f1: [[0.47, 0], [0.53, 1], [0.95, 1], [0.975, 0]],
}

// day (0) -> night (1)
export const NIGHT = [[0, 0.0], [0.9, 0.08], [0.955, 0.4], [0.985, 1]]

// speech bubbles in the lobby [actor, text, from, to]
export const BUBBLES = [
  ['Queue_1', '🇮🇹 A che ora è la colazione?', 0.245, T1 + 0.004],
  ['Queue_2', '🇬🇧 What’s the Wi-Fi password?', 0.255, T2 + 0.004],
  ['Queue_3', '🇩🇪 Gibt es einen Parkplatz?', 0.265, T3 + 0.004],
  ['Queue_4', '🇫🇷 Un bon resto pour ce soir ?', 0.275, T4 + 0.004],
  ['Guest_B', '🇪🇸 ¿Hay toallas para la piscina?', 0.285, 0.39],
  ['Guest_A', '🇳🇱 Kunnen we fietsen huren?', 0.3, 0.385],
  ['Staff', 'Un attimo, arrivo…', 0.27, 0.37],
]

// chat on the phone: [from, who, text]
export const CHAT = [
  [0.762, 'guest', 'Ciao! A che ora è la colazione domani?'],
  [0.778, 'bot', 'Buongiorno! 🌿 La colazione è servita dalle 7:00 alle 10:30 nella sala al piano terra. Il cornetto al pistacchio va a ruba: meglio non arrivare tardi 😉'],
  [0.8, 'guest', 'Perfetto. Possiamo avere due asciugamani in più?'],
  [0.815, 'bot', 'Certo! Ho passato la richiesta alla reception: arrivano in camera 101 a breve.'],
  [0.828, 'ticket', 'Richiesta inviata · Asciugamani × 2 · Camera 101'],
]

export const TICKET = [0.838, 0.89] // ticket flies from the phone to the reception monitor
// bezier control points of the ticket flight (Blender coords): phone -> in front of the hotel -> monitor
export const TICKET_PTS = [[-2.1, 3.4, 5.0], [-1.0, -7.5, 6.4], [1.6, -9.0, 2.4], [-2.3, 2.25, 1.75]]
export const DASH = [0.888, 0.95] // dashboard overlay

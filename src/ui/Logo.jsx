import { useId } from 'react'
import { PICTO_BAFFO, PICTO_HEADS, WORD_CON, WORD_SERGIO, WORD_AI } from './logoPaths'

export function Picto({ white = false, className }) {
  const id = useId()
  const fill = white ? '#fff' : `url(#${id})`
  return (
    <svg viewBox="0 0 168 111" className={className} aria-hidden="true">
      {!white && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="168" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0E5C45" />
            <stop offset="1" stopColor="#2FAE7D" />
          </linearGradient>
        </defs>
      )}
      <g fill={fill}>
        <path d={PICTO_BAFFO} />
        {PICTO_HEADS.map(([cx, cy, rx, ry]) => (
          <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} />
        ))}
      </g>
    </svg>
  )
}

// Full wordmark. `tone="dark"` = official light-background version, `tone="light"` for dark backgrounds
export function Logo({ tone = 'dark', className }) {
  const id = useId()
  const text = tone === 'dark' ? '#0E2A22' : '#ffffff'
  const stop1 = tone === 'dark' ? '#25936A' : '#5fd3a4'
  const stop0 = tone === 'dark' ? '#0E5C45' : '#2FAE7D'
  return (
    <svg viewBox="0 0 869.29 110.73" className={className} role="img" aria-label="ConSergio.ai">
      <defs>
        <linearGradient id={`${id}w`} x1="406" y1="0" x2="743" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={stop0} />
          <stop offset="1" stopColor={stop1} />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="168" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={stop0} />
          <stop offset="1" stopColor={stop1} />
        </linearGradient>
      </defs>
      <g fill={text}>
        {WORD_CON.map((d) => <path key={d} d={d} />)}
        {WORD_AI.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill={`url(#${id}w)`}>
        {WORD_SERGIO.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill={`url(#${id}p)`}>
        <path d={PICTO_BAFFO} />
        {PICTO_HEADS.map(([cx, cy, rx, ry]) => (
          <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} />
        ))}
      </g>
    </svg>
  )
}

import * as THREE from 'three'
import QRCode from 'qrcode'
import { PICTO_BAFFO, PICTO_HEADS } from '../ui/logoPaths'

// Printable table tent card: picto + "Chiedi a ConSergio" + real QR to consergio.ai
export async function makeQrCardTexture(url = 'https://www.consergio.ai/it') {
  const W = 500, H = 690
  const c = document.createElement('canvas')
  c.width = W * 2
  c.height = H * 2
  const g = c.getContext('2d')
  g.scale(2, 2)
  try {
    await document.fonts.load('700 40px Ubuntu')
    await document.fonts.load('500 20px Ubuntu')
  } catch (e) {}

  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  // top band
  const grad = g.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#0E5C45')
  grad.addColorStop(1, '#25936A')
  g.fillStyle = grad
  g.fillRect(0, 0, W, 150)

  // picto in white
  g.save()
  g.translate(W / 2 - 60, 22)
  g.scale(120 / 168, 120 / 168)
  g.fillStyle = '#ffffff'
  g.fill(new Path2D(PICTO_BAFFO))
  for (const [cx, cy, rx, ry] of PICTO_HEADS) {
    g.beginPath()
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()

  g.textAlign = 'center'
  g.fillStyle = '#0E2A22'
  g.font = '500 22px Ubuntu, sans-serif'
  g.fillText('Hai bisogno di qualcosa?', W / 2, 192)
  g.font = '700 38px Ubuntu, sans-serif'
  g.fillStyle = '#0E5C45'
  g.fillText('Chiedi a ConSergio', W / 2, 236)

  const qc = document.createElement('canvas')
  await QRCode.toCanvas(qc, url, { margin: 0, width: 300, color: { dark: '#0E2A22', light: '#ffffff' } })
  g.drawImage(qc, W / 2 - 150, 262, 300, 300)

  g.font = '500 19px Ubuntu, sans-serif'
  g.fillStyle = '#3d5449'
  g.fillText('Inquadra · Scan · Scannen · Escanear', W / 2, 600)
  g.font = '700 22px Ubuntu, sans-serif'
  g.fillStyle = '#0E5C45'
  g.fillText('Camera 101 · consergio.ai', W / 2, 640)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false // glTF UVs
  tex.anisotropy = 8
  return tex
}

// small card texture for the request ticket that flies to the reception
export function makeTicketTexture() {
  const W = 400, H = 220
  const c = document.createElement('canvas')
  c.width = W * 2
  c.height = H * 2
  const g = c.getContext('2d')
  g.scale(2, 2)
  const r = 28
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(0, 0, W, H, r)
  g.fill()
  g.fillStyle = '#2FAE7D'
  g.beginPath()
  g.roundRect(0, 0, 14, H, [r, 0, 0, r])
  g.fill()
  g.fillStyle = '#e3f4ec'
  g.beginPath()
  g.roundRect(34, 26, 92, 34, 17)
  g.fill()
  g.fillStyle = '#0E5C45'
  g.font = '700 18px Ubuntu, sans-serif'
  g.fillText('NUOVA', 48, 49)
  g.fillStyle = '#0E2A22'
  g.font = '700 34px Ubuntu, sans-serif'
  g.fillText('Camera 101', 34, 112)
  g.font = '500 24px Ubuntu, sans-serif'
  g.fillStyle = '#3d5449'
  g.fillText('Asciugamani × 2 · 🇮🇹', 34, 152)
  g.font = '500 18px Ubuntu, sans-serif'
  g.fillStyle = '#25936A'
  g.fillText('via assistente AI', 34, 188)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

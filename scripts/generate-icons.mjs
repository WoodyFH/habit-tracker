// Erzeugt die PNG-Icons für PWA / iOS aus einem SVG. Aufruf: npm run icons
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs>`

// "any": abgerundetes Quadrat
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${gradient}
  <rect width="512" height="512" rx="116" fill="url(#g)"/>
  <path d="M136 268l84 84 156-176" fill="none" stroke="#fff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// "maskable" / iOS: vollflächiger Hintergrund (das Betriebssystem rundet selbst ab),
// Motiv in der Safe-Zone (innere ~60 %).
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${gradient}
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
  <path d="M136 268l84 84 156-176" fill="none" stroke="#fff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`

const jobs = [
  ['icon-192.png', any, 192],
  ['icon-512.png', any, 512],
  ['icon-maskable-512.png', full, 512],
  ['apple-touch-icon.png', full, 180],
]

for (const [name, svg, size] of jobs) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(join(pub, name), buf)
  console.log('✓', name)
}

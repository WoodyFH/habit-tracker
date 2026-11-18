// IDs: zufällig (neue Zeilen) oder deterministisch (Zeilen, die pro Schlüssel nur einmal existieren dürfen).

/** Zufällige UUID v4. */
export function uuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** 128-Bit-Hash (cyrb128), synchron, ohne Abhängigkeiten. */
function hash128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
}

/**
 * Deterministische UUID aus einem Schlüssel (z. B. habit_id + Datum).
 * Zwei Geräte, die offline denselben Eintrag anlegen, erzeugen so dieselbe ID –
 * dadurch gibt es beim Sync nie einen Konflikt mit dem Unique-Constraint (habit_id, date).
 */
export function deterministicId(...parts: string[]): string {
  const [a, b, c, d] = hash128(parts.join('\u0000'))
  const hex = [a, b, c, d].map((x) => x.toString(16).padStart(8, '0')).join('')
  // Version 5 / Variante 10xx setzen, damit es eine gültige UUID ist.
  const v = hex.slice(0, 12) + '5' + hex.slice(13, 16) + ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17)
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}`
}

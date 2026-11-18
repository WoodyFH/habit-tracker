import { describe, expect, it } from 'vitest'
import { cleanKey, isSecretKey, normalizeSupabaseUrl } from './supabaseConfig'

const jwt = (payload: object) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signatur`
}

describe('normalizeSupabaseUrl', () => {
  it('lässt eine saubere URL unverändert', () => {
    expect(normalizeSupabaseUrl('https://abcd.supabase.co')).toBe('https://abcd.supabase.co')
  })
  it('entfernt Schrägstrich am Ende und Pfade', () => {
    expect(normalizeSupabaseUrl('https://abcd.supabase.co/')).toBe('https://abcd.supabase.co')
    expect(normalizeSupabaseUrl('https://abcd.supabase.co/rest/v1/')).toBe('https://abcd.supabase.co')
    expect(normalizeSupabaseUrl('https://abcd.supabase.co/auth/v1')).toBe('https://abcd.supabase.co')
  })
  it('entfernt Leerzeichen, Zeilenumbrüche und Anführungszeichen', () => {
    expect(normalizeSupabaseUrl('  "https://abcd.supabase.co"\n')).toBe('https://abcd.supabase.co')
  })
  it('lehnt Ungültiges ab', () => {
    expect(normalizeSupabaseUrl('')).toBeNull()
    expect(normalizeSupabaseUrl(undefined)).toBeNull()
    expect(normalizeSupabaseUrl('abcd.supabase.co')).toBeNull()
    expect(normalizeSupabaseUrl('ftp://abcd.supabase.co')).toBeNull()
  })
})

describe('isSecretKey', () => {
  it('erkennt service_role-JWTs und sb_secret-Keys', () => {
    expect(isSecretKey(jwt({ role: 'service_role' }))).toBe(true)
    expect(isSecretKey('sb_secret_abc123')).toBe(true)
  })
  it('lässt anon-JWTs und publishable Keys zu', () => {
    expect(isSecretKey(jwt({ role: 'anon' }))).toBe(false)
    expect(isSecretKey('sb_publishable_abc123')).toBe(false)
    expect(isSecretKey('irgendwas')).toBe(false)
    expect(isSecretKey(undefined)).toBe(false)
  })
})

describe('cleanKey', () => {
  it('trimmt und entfernt Anführungszeichen', () => {
    expect(cleanKey(' "abc" \n')).toBe('abc')
    expect(cleanKey('')).toBeNull()
  })
})

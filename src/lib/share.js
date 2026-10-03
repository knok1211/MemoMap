// Serialize the whole route (points in order, memos, travel mode) into a URL hash.
//
// Hash format:  #r=<flag><base64url(payload)>
//   flag 'z' = payload is deflate-raw compressed JSON, 'j' = plain JSON (UTF-8)
// JSON payload: { v: 1, m: 'driving', p: [ [lat, lng, name, memo] | null, ... ] }
//   p lists [start, ...vias, end]; start / end may be null while not yet chosen.

const VERSION = 1
const HASH_KEY = 'r'
const MODES = ['driving', 'cycling', 'walking']
const MAX_POINTS = 25
const MAX_TEXT = 100
const MAX_HASH_CHARS = 20000 // refuse absurdly large links before decoding
const MAX_DECODED_BYTES = 64 * 1024 // guards against decompression bombs

function toBase64Url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes, stream, limit = Infinity) {
  const writer = stream.writable.getWriter()
  writer.write(bytes).catch(() => {})
  writer.close().catch(() => {})
  const reader = stream.readable.getReader()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      reader.cancel()
      throw new LinkError('too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

const hasCompression = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

const round6 = (n) => Math.round(n * 1e6) / 1e6

// state: { start, vias, end, profile } -> hash string without the leading '#', or '' when empty
export async function encodeState({ start, vias, end, profile }) {
  if (!start && !end && vias.length === 0) return ''
  const slots = [start, ...vias, end]
  const payload = {
    v: VERSION,
    m: profile,
    p: slots.map((s) => (s ? [round6(s.lat), round6(s.lng), (s.name || '').slice(0, MAX_TEXT), s.memo || ''] : null)),
  }
  const raw = new TextEncoder().encode(JSON.stringify(payload))
  let best = 'j' + toBase64Url(raw)
  if (hasCompression) {
    try {
      const z = 'z' + toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')))
      if (z.length < best.length) best = z
    } catch {
      /* fall back to plain */
    }
  }
  return `${HASH_KEY}=${best}`
}

export function readHash(hash) {
  const m = /^#?r=([A-Za-z0-9_-]+)$/.exec(hash || '')
  return m ? m[1] : null
}

const isNum = (n, lim) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= lim

class LinkError extends Error {}

// Returns { start, vias, end, profile }; throws Error with a user-facing message on anything malformed.
export async function decodeState(data) {
  try {
    return await decode(data)
  } catch (e) {
    throw e instanceof LinkError ? e : new Error('손상된 링크입니다.')
  }
}

async function decode(data) {
  if (data.length > MAX_HASH_CHARS) throw new LinkError('링크가 너무 깁니다.')
  const flag = data[0]
  let bytes = fromBase64Url(data.slice(1))
  if (flag === 'z') {
    if (!hasCompression) throw new LinkError('이 브라우저에서는 링크를 열 수 없습니다.')
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_DECODED_BYTES)
  } else if (flag !== 'j') {
    throw new LinkError('알 수 없는 링크 형식입니다.')
  }
  const obj = JSON.parse(new TextDecoder().decode(bytes))

  if (obj?.v !== VERSION) throw new LinkError('지원하지 않는 링크 버전입니다.')
  if (!MODES.includes(obj.m)) throw new LinkError('이동수단이 올바르지 않습니다.')
  if (!Array.isArray(obj.p) || obj.p.length < 2 || obj.p.length > MAX_POINTS) throw new LinkError('지점 정보가 올바르지 않습니다.')

  const slots = obj.p.map((s) => {
    if (s === null) return null
    if (!Array.isArray(s) || !isNum(s[0], 90) || !isNum(s[1], 180)) throw new LinkError('좌표가 올바르지 않습니다.')
    const name = typeof s[2] === 'string' ? s[2].slice(0, MAX_TEXT) : ''
    const memo = typeof s[3] === 'string' ? s[3].slice(0, MAX_TEXT) : ''
    return { id: crypto.randomUUID(), lat: s[0], lng: s[1], name: name || `${s[0].toFixed(5)}, ${s[1].toFixed(5)}`, memo }
  })
  const mid = slots.slice(1, -1)
  if (mid.some((s) => s === null)) throw new LinkError('지점 정보가 올바르지 않습니다.')
  return { start: slots[0], vias: mid, end: slots[slots.length - 1], profile: obj.m }
}

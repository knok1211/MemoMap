import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView.jsx'
import PointList from './components/PointList.jsx'
import { getRoute, reverseGeocode, fmtDistance, fmtDuration } from './lib/api.js'
import { decodeState, encodeState, readHash } from './lib/share.js'

const SHARE_WARN_LENGTH = 2000
const MEMO_SAVE_DELAY = 300

const PROFILES = [
  ['driving', '🚗 자동차'],
  ['cycling', '🚴 자전거'],
  ['walking', '🚶 도보'],
]

const coordName = (pos) => `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`

export default function App() {
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [vias, setVias] = useState([]) // waypoints between start and end
  const [profile, setProfile] = useState('driving')
  const [route, setRoute] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [routing, setRouting] = useState(false)
  const [ready, setReady] = useState(false) // URL has been read; only then may we write it back
  const [focus, setFocus] = useState(null) // { token, points } asks the map to frame restored points
  const [shareUrl, setShareUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const [copied, setCopied] = useState(false)
  const lastHash = useRef('') // hash we wrote ourselves, to tell it apart from a pasted link

  // Restore state from the URL on load, and when a different link is pasted into this tab.
  useEffect(() => {
    let alive = true
    async function restore() {
      const data = readHash(window.location.hash)
      if (!data) {
        if (window.location.hash) setLinkError('공유 링크를 읽을 수 없습니다.')
        setReady(true)
        return
      }
      try {
        const s = await decodeState(data)
        if (!alive) return
        setStart(s.start)
        setVias(s.vias)
        setEnd(s.end)
        setProfile(s.profile)
        setLinkError('')
        setFocus({ token: Date.now(), points: [s.start, ...s.vias, s.end].filter(Boolean).map((p) => [p.lat, p.lng]) })
      } catch (e) {
        if (!alive) return
        setLinkError(`공유 링크를 열 수 없습니다. (${e.message})`)
        history.replaceState(null, '', window.location.pathname + window.location.search)
      } finally {
        if (alive) setReady(true)
      }
    }
    restore()
    window.addEventListener('hashchange', restore)
    return () => {
      alive = false
      window.removeEventListener('hashchange', restore)
    }
  }, [])

  // Keep the address bar in sync so copying it is enough to share.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const t = setTimeout(async () => {
      const hash = await encodeState({ start, vias, end, profile })
      if (cancelled) return
      lastHash.current = hash
      const base = window.location.pathname + window.location.search
      history.replaceState(null, '', hash ? `${base}#${hash}` : base)
      setShareUrl(hash ? window.location.href : '')
    }, MEMO_SAVE_DELAY)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [ready, start, vias, end, profile])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // clipboard needs a secure context (https / localhost); fall back to manual copy
      window.prompt('링크를 복사하세요 (Ctrl+C)', shareUrl)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const points = useMemo(() => (start && end ? [start, ...vias, end] : null), [start, vias, end])
  // Key on coordinates only, so filling in a place name or memo does not trigger a new request.
  const pointsKey = points ? points.map((p) => `${p.lat},${p.lng}`).join(';') : ''

  useEffect(() => {
    if (!points) {
      setRoute(null)
      setRouteError('')
      return
    }
    let cancelled = false
    setRouting(true)
    setRouteError('')
    getRoute(profile, points)
      .then((r) => !cancelled && setRoute(r))
      .catch((e) => {
        if (cancelled) return
        setRoute(null)
        setRouteError(e.message)
      })
      .finally(() => !cancelled && setRouting(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, profile])

  // Apply fn to the point with this id, wherever it lives (start / via / end).
  function updatePoint(id, fn) {
    setStart((cur) => (cur?.id === id ? fn(cur) : cur))
    setEnd((cur) => (cur?.id === id ? fn(cur) : cur))
    setVias((v) => v.map((p) => (p.id === id ? fn(p) : p)))
  }

  // Replace the place name with a looked-up address, unless the point has moved on since.
  async function fillName(id, pos) {
    const name = await reverseGeocode(pos.lat, pos.lng)
    if (name) updatePoint(id, (p) => (p.lat === pos.lat && p.lng === pos.lng ? { ...p, name } : p))
  }

  // Right-click menu: set start / add via / set end at a map position.
  function setPoint(kind, pos) {
    const place = { ...pos, id: crypto.randomUUID(), name: coordName(pos), memo: '' }
    if (kind === 'start') setStart(place)
    else if (kind === 'end') setEnd(place)
    else setVias((v) => [...v, place])
    fillName(place.id, pos)
  }

  // Marker dragged to a new position.
  function movePoint(id, pos) {
    updatePoint(id, (p) => ({ ...p, ...pos, name: coordName(pos) }))
    fillName(id, pos)
  }

  const changeMemo = (id, memo) => updatePoint(id, (p) => ({ ...p, memo }))

  function removePoint(id) {
    setStart((cur) => (cur?.id === id ? null : cur))
    setEnd((cur) => (cur?.id === id ? null : cur))
    setVias((v) => v.filter((p) => p.id !== id))
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>📝 MemoMap</h1>

        <PointList
          start={start}
          vias={vias}
          end={end}
          swapDisabled={!start && !end && vias.length === 0}
          onMemoChange={changeMemo}
          onChange={({ start, vias, end }) => {
            setStart(start)
            setVias(vias)
            setEnd(end)
          }}
        />
        <p className="muted hint">지도에서 우클릭(모바일: 길게 누르기)하여 출발지·경유지·도착지를 지정하세요.</p>

        <div className="profiles">
          {PROFILES.map(([k, label]) => (
            <button key={k} className={profile === k ? 'on' : ''} onClick={() => setProfile(k)}>{label}</button>
          ))}
        </div>

        <div className="share">
          <button className="primary" onClick={copyLink} disabled={!shareUrl}>
            {copied ? '✓ 복사됨' : '🔗 링크 복사'}
          </button>
          <p className="muted hint">경로와 메모가 링크에 그대로 담깁니다. 민감한 정보는 메모에 적지 마세요.</p>
          {shareUrl.length > SHARE_WARN_LENGTH && (
            <p className="error">링크가 매우 깁니다({shareUrl.length}자). 일부 메신저나 브라우저에서 잘릴 수 있으니 지점이나 메모를 줄여 보세요.</p>
          )}
          {linkError && <p className="error">{linkError}</p>}
        </div>

        {routing && <p className="muted">경로 계산 중…</p>}
        {routeError && <p className="error">{routeError}</p>}
        {route && (
          <div className="summary">
            <div className="big">{fmtDuration(route.duration)} <small>{fmtDistance(route.distance)}</small></div>
            <ol className="steps">
              {route.steps.map((s, i) => (
                <li key={i}><span>{s.text}</span><em>{fmtDistance(s.distance)}</em></li>
              ))}
            </ol>
          </div>
        )}
      </aside>

      <main>
        <MapView
          start={start}
          end={end}
          vias={vias}
          route={route}
          focus={focus}
          onSetPoint={setPoint}
          onMovePoint={movePoint}
          onMemoChange={changeMemo}
          onRemovePoint={removePoint}
        />
      </main>
    </div>
  )
}

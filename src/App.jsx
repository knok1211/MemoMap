import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import PointList from './components/PointList.jsx'
import { getRoute, reverseGeocode, fmtDistance, fmtDuration } from './lib/api.js'

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
          onSetPoint={setPoint}
          onMovePoint={movePoint}
          onMemoChange={changeMemo}
          onRemovePoint={removePoint}
        />
      </main>
    </div>
  )
}

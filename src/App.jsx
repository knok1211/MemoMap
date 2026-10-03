import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import PointList from './components/PointList.jsx'
import MemoPanel, { MemoForm } from './components/MemoPanel.jsx'
import { getRoute, reverseGeocode, fmtDistance, fmtDuration } from './lib/api.js'
import { distanceToLine } from './lib/geo.js'
import { useMemos } from './lib/useMemos.js'

const PROFILES = [
  ['driving', '🚗 자동차'],
  ['cycling', '🚴 자전거'],
  ['walking', '🚶 도보'],
]
const NEAR_METERS = 200

export default function App() {
  const { memos, addMemo, updateMemo, removeMemo } = useMemos()
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [vias, setVias] = useState([]) // waypoints between start and end
  const [profile, setProfile] = useState('driving')
  const [route, setRoute] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [routing, setRouting] = useState(false)
  const [mode, setMode] = useState(null) // 'memo' | null (click-to-place a memo)
  const [draft, setDraft] = useState(null) // memo being created/edited
  const [selectedId, setSelectedId] = useState(null)
  const [flyTo, setFlyTo] = useState(null)
  const [tab, setTab] = useState('route')

  const points = useMemo(() => (start && end ? [start, ...vias, end] : null), [start, vias, end])
  // Key on coordinates only, so filling in a place name does not trigger a new request.
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

  const nearMemos = useMemo(() => {
    if (!route) return []
    return memos.filter((m) => distanceToLine(m, route.line) <= NEAR_METERS)
  }, [route, memos])
  const nearIds = useMemo(() => new Set(nearMemos.map((m) => m.id)), [nearMemos])

  function handleMapClick(pos) {
    if (mode === 'memo') {
      setDraft({ ...pos })
      setTab('memo')
      setMode(null)
    }
  }

  // Right-click menu: set start / add via / set end at a map position.
  async function setPoint(kind, pos) {
    const place = { ...pos, id: crypto.randomUUID(), name: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` }
    const patch = (list) => list.map((p) => (p.id === place.id ? { ...p, name } : p))
    let name = null

    if (kind === 'start') setStart(place)
    else if (kind === 'end') setEnd(place)
    else setVias((v) => [...v, place])
    setTab('route')

    name = await reverseGeocode(pos.lat, pos.lng)
    if (!name) return
    if (kind === 'start') setStart((cur) => (cur?.id === place.id ? { ...cur, name } : cur))
    else if (kind === 'end') setEnd((cur) => (cur?.id === place.id ? { ...cur, name } : cur))
    else setVias(patch)
  }

  // Marker dragged to a new position: move the point, then refresh its place name.
  async function movePoint(kind, id, pos) {
    const apply = (fn) => {
      if (kind === 'start') setStart((cur) => (cur?.id === id ? fn(cur) : cur))
      else if (kind === 'end') setEnd((cur) => (cur?.id === id ? fn(cur) : cur))
      else setVias((v) => v.map((p) => (p.id === id ? fn(p) : p)))
    }
    apply((p) => ({ ...p, ...pos, name: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` }))
    const name = await reverseGeocode(pos.lat, pos.lng)
    if (name) apply((p) => (p.lat === pos.lat && p.lng === pos.lng ? { ...p, name } : p))
  }

  const removeVia = (id) => setVias((v) => v.filter((x) => x.id !== id))

  function useMemoAs(m, which) {
    const place = { id: crypto.randomUUID(), lat: m.lat, lng: m.lng, name: `📝 ${m.title}` }
    if (which === 'start') setStart(place)
    else setEnd(place)
    setTab('route')
  }

  function saveDraft(fields) {
    if (draft.id) updateMemo(draft.id, fields)
    else addMemo({ lat: draft.lat, lng: draft.lng, ...fields })
    setDraft(null)
  }

  function selectMemo(id) {
    setSelectedId(id)
    const m = memos.find((x) => x.id === id)
    if (m) setFlyTo({ lat: m.lat, lng: m.lng, t: Date.now() })
  }

  function deleteMemo(id) {
    removeMemo(id)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>📝 MemoMap</h1>
        <nav className="tabs">
          <button className={tab === 'route' ? 'on' : ''} onClick={() => setTab('route')}>길찾기</button>
          <button className={tab === 'memo' ? 'on' : ''} onClick={() => setTab('memo')}>메모 ({memos.length})</button>
        </nav>

        {tab === 'route' && (
          <section>
            <PointList
              start={start}
              vias={vias}
              end={end}
              swapDisabled={!start && !end && vias.length === 0}
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
                {nearMemos.length > 0 && (
                  <div className="near">
                    <strong>경로 근처 메모 {nearMemos.length}개</strong>
                    <ul>
                      {nearMemos.map((m) => (
                        <li key={m.id}><button onClick={() => selectMemo(m.id)}>{m.title}</button></li>
                      ))}
                    </ul>
                  </div>
                )}
                <ol className="steps">
                  {route.steps.map((s, i) => (
                    <li key={i}><span>{s.text}</span><em>{fmtDistance(s.distance)}</em></li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {tab === 'memo' && (
          <section>
            {draft ? (
              <MemoForm key={draft.id || 'new'} draft={draft} onSave={saveDraft} onCancel={() => setDraft(null)} />
            ) : (
              <button className={mode === 'memo' ? 'primary active' : 'primary'} onClick={() => setMode(mode === 'memo' ? null : 'memo')}>
                {mode === 'memo' ? '지도에서 위치를 클릭하세요… (취소)' : '＋ 메모 추가'}
              </button>
            )}
            <MemoPanel
              memos={memos}
              nearIds={nearIds}
              selectedId={selectedId}
              onSelect={selectMemo}
              onEdit={(m) => setDraft(m)}
              onRemove={deleteMemo}
              onUseAs={useMemoAs}
            />
          </section>
        )}
      </aside>

      <main>
        {mode && (
          <div className="banner">
            메모를 남길 위치를 지도에서 클릭하세요
          </div>
        )}
        <MapView
          start={start}
          end={end}
          vias={vias}
          route={route}
          memos={memos}
          draft={draft && !draft.id ? draft : null}
          selectedId={selectedId}
          flyTo={flyTo}
          picking={!!mode}
          onMapClick={handleMapClick}
          onSetPoint={setPoint}
          onMovePoint={movePoint}
          onRemoveVia={removeVia}
          onSelectMemo={setSelectedId}
          onUseAs={useMemoAs}
          onRemove={deleteMemo}
        />
      </main>
    </div>
  )
}

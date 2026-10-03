import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import SearchBox from './components/SearchBox.jsx'
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
  const [profile, setProfile] = useState('driving')
  const [route, setRoute] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [routing, setRouting] = useState(false)
  const [mode, setMode] = useState(null) // 'start' | 'end' | 'memo' | null
  const [draft, setDraft] = useState(null) // memo being created/edited
  const [selectedId, setSelectedId] = useState(null)
  const [flyTo, setFlyTo] = useState(null)
  const [tab, setTab] = useState('route')

  useEffect(() => {
    if (!start || !end) {
      setRoute(null)
      return
    }
    let cancelled = false
    setRouting(true)
    setRouteError('')
    getRoute(profile, [start, end])
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
  }, [start, end, profile])

  const nearMemos = useMemo(() => {
    if (!route) return []
    return memos.filter((m) => distanceToLine(m, route.line) <= NEAR_METERS)
  }, [route, memos])
  const nearIds = useMemo(() => new Set(nearMemos.map((m) => m.id)), [nearMemos])

  async function handleMapClick(pos) {
    if (mode === 'memo') {
      setDraft({ ...pos })
      setTab('memo')
      setMode(null)
    } else if (mode === 'start' || mode === 'end') {
      const setter = mode === 'start' ? setStart : setEnd
      const place = { ...pos, name: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` }
      setter(place)
      setMode(null)
      const name = await reverseGeocode(pos.lat, pos.lng)
      if (name) setter((cur) => (cur === place ? { ...place, name } : cur))
    }
  }

  function useMemoAs(m, which) {
    const place = { lat: m.lat, lng: m.lng, name: `📝 ${m.title}` }
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

  const swap = () => {
    setStart(end)
    setEnd(start)
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
            <SearchBox label="출발지" placeholder="장소 검색" value={start} onPick={setStart} onClear={() => setStart(null)} picking={mode === 'start'} onPickOnMap={() => setMode(mode === 'start' ? null : 'start')} />
            <button className="swap" onClick={swap} disabled={!start && !end}>⇅ 바꾸기</button>
            <SearchBox label="도착지" placeholder="장소 검색" value={end} onPick={setEnd} onClear={() => setEnd(null)} picking={mode === 'end'} onPickOnMap={() => setMode(mode === 'end' ? null : 'end')} />

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
            {mode === 'memo' ? '메모를 남길 위치를' : mode === 'start' ? '출발지를' : '도착지를'} 지도에서 클릭하세요
          </div>
        )}
        <MapView
          start={start}
          end={end}
          route={route}
          memos={memos}
          draft={draft && !draft.id ? draft : null}
          selectedId={selectedId}
          flyTo={flyTo}
          picking={!!mode}
          onMapClick={handleMapClick}
          onSelectMemo={setSelectedId}
          onUseAs={useMemoAs}
          onRemove={deleteMemo}
        />
      </main>
    </div>
  )
}

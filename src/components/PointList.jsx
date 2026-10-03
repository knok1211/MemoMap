import { useState } from 'react'
import SearchBox from './SearchBox.jsx'

const badge = (i, last) => (i === 0 ? ['A', '#16a34a'] : i === last ? ['B', '#dc2626'] : [String(i), '#f97316'])
const newId = () => crypto.randomUUID()

// Start / via / end rendered as one uniform list; drag rows to reorder.
// Role follows position: first = start, last = end, the rest = vias.
export default function PointList({ start, vias, end, onChange, swapDisabled }) {
  const slots = [start, ...vias, end]
  const last = slots.length - 1
  const [from, setFrom] = useState(null)
  const [over, setOver] = useState(null)

  const commit = (next) => onChange({ start: next[0], vias: next.slice(1, -1).filter(Boolean), end: next[next.length - 1] })

  const setSlot = (i, place) => commit(slots.map((s, k) => (k === i ? place : s)))

  function drop(to) {
    if (from !== null && from !== to) {
      const next = [...slots]
      if (!next[to]) {
        // empty target: swap into the empty slot
        ;[next[from], next[to]] = [next[to], next[from]]
      } else {
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
      }
      commit(next)
    }
    setFrom(null)
    setOver(null)
  }

  const remove = (i) => (i === 0 || i === last ? setSlot(i, null) : commit(slots.filter((_, k) => k !== i)))
  const reverse = () => commit([...slots].reverse())

  return (
    <div className="points">
      {slots.map((p, i) => {
        const [label, color] = badge(i, last)
        const hint = i === 0 ? '출발지 검색' : '도착지 검색'
        return (
          <div
            key={p ? p.id : i === 0 ? 'empty-start' : 'empty-end'}
            className={`point${over === i && from !== i ? ' over' : ''}${from === i ? ' dragging' : ''}`}
            draggable={!!p}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(i))
              setFrom(i)
            }}
            onDragOver={(e) => {
              if (from === null) return
              e.preventDefault()
              setOver(i)
            }}
            onDrop={(e) => {
              e.preventDefault()
              drop(i)
            }}
            onDragEnd={() => {
              setFrom(null)
              setOver(null)
            }}
          >
            <span className="grip" aria-hidden>{p ? '⋮⋮' : ''}</span>
            <span className="badge-pt" style={{ background: color }}>{label}</span>
            {p ? (
              <>
                <span className="pname" title={p.name}>{p.name}</span>
                <button className="icon" onClick={() => remove(i)} aria-label="지점 삭제">✕</button>
              </>
            ) : (
              <SearchBox placeholder={hint} onPick={(r) => setSlot(i, { ...r, id: newId() })} />
            )}
          </div>
        )
      })}
      <button className="swap" onClick={reverse} disabled={swapDisabled}>⇅ 순서 뒤집기</button>
    </div>
  )
}

import { useState } from 'react'
import { searchPlaces } from '../lib/api.js'

export default function SearchBox({ label, value, placeholder, onPick, onClear, onPickOnMap, picking }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await searchPlaces(q)
      setResults(r)
      if (!r.length) setError('검색 결과가 없습니다.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function pick(r) {
    onPick(r)
    setResults([])
    setQ('')
  }

  return (
    <div className="field">
      <label>{label}</label>
      {value ? (
        <div className="chosen">
          <span title={value.name}>{value.name}</span>
          <button className="icon" onClick={onClear} aria-label="지우기">✕</button>
        </div>
      ) : (
        <form onSubmit={submit} className="row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
          <button type="submit" disabled={loading}>{loading ? '…' : '검색'}</button>
          <button type="button" className={picking ? 'active' : ''} onClick={onPickOnMap} title="지도에서 선택">📍</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {results.length > 0 && (
        <ul className="results">
          {results.map((r, i) => (
            <li key={i}><button onClick={() => pick(r)}>{r.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

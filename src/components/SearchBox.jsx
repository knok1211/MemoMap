import { useState } from 'react'
import { searchPlaces } from '../lib/api.js'

export default function SearchBox({ placeholder, onPick }) {
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
    <div className="search">
      <form onSubmit={submit} className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
        <button type="submit" disabled={loading}>{loading ? '…' : '검색'}</button>
      </form>
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

import { useEffect, useState } from 'react'

const KEY = 'memomap.memos'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function useMemos() {
  const [memos, setMemos] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(memos))
    } catch {
      /* storage unavailable */
    }
  }, [memos])

  const addMemo = (memo) =>
    setMemos((m) => [{ id: crypto.randomUUID(), createdAt: Date.now(), ...memo }, ...m])
  const updateMemo = (id, patch) =>
    setMemos((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const removeMemo = (id) => setMemos((m) => m.filter((x) => x.id !== id))

  return { memos, addMemo, updateMemo, removeMemo }
}

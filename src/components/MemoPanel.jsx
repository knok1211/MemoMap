import { useState } from 'react'

export const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6']

export function MemoForm({ draft, onSave, onCancel }) {
  const [title, setTitle] = useState(draft.title || '')
  const [text, setText] = useState(draft.text || '')
  const [color, setColor] = useState(draft.color || COLORS[0])

  return (
    <form
      className="memo-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() && !text.trim()) return
        onSave({ title: title.trim() || '제목 없음', text: text.trim(), color })
      }}
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="메모 제목" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="내용 (예: 주차 가능, 여기서 점심)" rows={3} />
      <div className="colors">
        {COLORS.map((c) => (
          <button type="button" key={c} className={c === color ? 'swatch on' : 'swatch'} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
        ))}
      </div>
      <div className="row">
        <button type="submit" className="primary">저장</button>
        <button type="button" onClick={onCancel}>취소</button>
      </div>
    </form>
  )
}

export default function MemoPanel({ memos, nearIds, selectedId, onSelect, onEdit, onRemove, onUseAs }) {
  const [query, setQuery] = useState('')
  const shown = memos.filter((m) => (m.title + m.text).toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="memo-panel">
      <input className="filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="메모 검색" />
      {shown.length === 0 && <p className="muted">메모가 없습니다. “메모 추가”를 누르고 지도를 클릭하세요.</p>}
      <ul className="memo-list">
        {shown.map((m) => (
          <li key={m.id} className={m.id === selectedId ? 'selected' : ''}>
            <div className="memo-head" onClick={() => onSelect(m.id)}>
              <span className="dot" style={{ background: m.color }} />
              <strong>{m.title}</strong>
              {nearIds.has(m.id) && <span className="badge">경로 근처</span>}
            </div>
            {m.text && <p>{m.text}</p>}
            <div className="row small">
              <button onClick={() => onUseAs(m, 'start')}>출발</button>
              <button onClick={() => onUseAs(m, 'end')}>도착</button>
              <button onClick={() => onEdit(m)}>수정</button>
              <button onClick={() => onRemove(m.id)}>삭제</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

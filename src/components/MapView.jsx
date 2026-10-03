import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

export const MEMO_MAX = 100

// Draggable marker handlers: report the new position when the drag ends.
const dragProps = (id, onMovePoint) => ({
  draggable: true,
  eventHandlers: {
    dragend: (e) => {
      const { lat, lng } = e.target.getLatLng()
      onMovePoint(id, { lat, lng })
    },
  },
})

// Icons are cached so re-renders (e.g. typing a memo) keep the same icon instance.
const iconCache = new Map()
const pin = (color, label, hasMemo) => {
  const key = `${color}|${label}|${hasMemo}`
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: '',
        html: `<div class="pin" style="background:${color}"><span>${label}</span>${hasMemo ? '<i class="memo-dot"></i>' : ''}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      })
    )
  }
  return iconCache.get(key)
}

function PointPopup({ title, point, onMemoChange, onRemove }) {
  const memo = point.memo || ''
  return (
    <div className="popup">
      <strong>{title}</strong>
      <div className="muted pname-small">{point.name}</div>
      <textarea
        value={memo}
        maxLength={MEMO_MAX}
        rows={2}
        placeholder="간단한 메모"
        onChange={(e) => onMemoChange(point.id, e.target.value)}
      />
      <div className="row small">
        <span className="muted count">{memo.length}/{MEMO_MAX}</span>
        <button onClick={() => onRemove(point.id)}>지점 삭제</button>
      </div>
    </div>
  )
}

const LONG_PRESS_MS = 600
const LONG_PRESS_SLOP = 10

// Reports clicks, right-clicks (contextmenu) and touch long-presses.
function MapEvents({ onClick, onContextMenu }) {
  const map = useMap()
  const longPressed = useRef(false) // swallow the click that follows a long press

  useMapEvents({
    click: () => {
      if (longPressed.current) {
        longPressed.current = false
        return
      }
      onClick()
    },
    contextmenu: (e) => {
      e.originalEvent.preventDefault()
      onContextMenu({ lat: e.latlng.lat, lng: e.latlng.lng }, e.containerPoint)
    },
    movestart: () => onContextMenu(null),
    zoomstart: () => onContextMenu(null),
  })

  // Touch screens have no right button; open the same menu on long press.
  useEffect(() => {
    const el = map.getContainer()
    let timer = null
    let origin = null

    const cancel = () => {
      clearTimeout(timer)
      timer = null
    }
    const down = (e) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return
      origin = { x: e.clientX, y: e.clientY }
      longPressed.current = false
      const ev = e
      timer = setTimeout(() => {
        longPressed.current = true
        const point = map.mouseEventToContainerPoint(ev)
        const ll = map.containerPointToLatLng(point)
        onContextMenu({ lat: ll.lat, lng: ll.lng }, point)
      }, LONG_PRESS_MS)
    }
    const move = (e) => {
      if (timer && origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > LONG_PRESS_SLOP) cancel()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', cancel)
    el.addEventListener('pointercancel', cancel)
    return () => {
      cancel()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', cancel)
      el.removeEventListener('pointercancel', cancel)
    }
  }, [map, onContextMenu])

  return null
}

function Fit({ line }) {
  const map = useMap()
  useEffect(() => {
    if (line?.length) map.fitBounds(L.latLngBounds(line), { padding: [60, 60] })
  }, [line, map])
  return null
}

// Frames restored points right away (before a route, if any, takes over via Fit).
function FitPoints({ focus }) {
  const map = useMap()
  useEffect(() => {
    if (!focus?.points.length) return
    if (focus.points.length === 1) map.setView(focus.points[0], 15)
    else map.fitBounds(L.latLngBounds(focus.points), { padding: [60, 60] })
  }, [focus, map])
  return null
}

export default function MapView({ start, end, vias, route, focus, onSetPoint, onMovePoint, onMemoChange, onRemovePoint }) {
  // { pos: {lat,lng}, x, y } while the right-click menu is open
  const [menu, setMenu] = useState(null)

  const openMenu = useCallback((pos, point) => setMenu(pos ? { pos, x: point.x, y: point.y } : null), [])
  const closeMenu = useCallback(() => setMenu(null), [])
  const choose = (kind) => {
    onSetPoint(kind, menu.pos)
    setMenu(null)
  }

  const popup = (title, point) => (
    <Popup>
      <PointPopup title={title} point={point} onMemoChange={onMemoChange} onRemove={onRemovePoint} />
    </Popup>
  )

  return (
    <div className="map-wrap">
      <MapContainer center={[37.5665, 126.978]} zoom={13} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onClick={closeMenu} onContextMenu={openMenu} />
        <FitPoints focus={focus} />
        <Fit line={route?.line} />

        {route && <Polyline positions={route.line} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.8 }} />}
        {start && (
          <Marker position={[start.lat, start.lng]} icon={pin('#16a34a', 'A', !!start.memo)} {...dragProps(start.id, onMovePoint)}>
            {popup('출발지', start)}
          </Marker>
        )}
        {vias.map((v, i) => (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={pin('#f97316', i + 1, !!v.memo)} {...dragProps(v.id, onMovePoint)}>
            {popup(`경유지 ${i + 1}`, v)}
          </Marker>
        ))}
        {end && (
          <Marker position={[end.lat, end.lng]} icon={pin('#dc2626', 'B', !!end.memo)} {...dragProps(end.id, onMovePoint)}>
            {popup('도착지', end)}
          </Marker>
        )}
      </MapContainer>

      {menu && (
        <ul className="ctx-menu" style={{ left: menu.x, top: menu.y }} onContextMenu={(e) => e.preventDefault()}>
          <li><button onClick={() => choose('start')}>🟢 시작지로 설정</button></li>
          <li><button onClick={() => choose('via')}>🟠 경유지로 추가</button></li>
          <li><button onClick={() => choose('end')}>🔴 목적지로 설정</button></li>
        </ul>
      )}
    </div>
  )
}

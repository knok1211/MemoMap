import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

// Draggable marker handlers: report the new position when the drag ends.
const dragProps = (kind, id, onMovePoint) => ({
  draggable: true,
  eventHandlers: {
    dragend: (e) => {
      const { lat, lng } = e.target.getLatLng()
      onMovePoint(kind, id, { lat, lng })
    },
  },
})

const pin = (color, label = '') =>
  L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })

const LONG_PRESS_MS = 600
const LONG_PRESS_SLOP = 10

// Reports clicks, right-clicks (contextmenu) and touch long-presses.
function MapEvents({ onClick, onContextMenu }) {
  const map = useMap()
  const longPressed = useRef(false) // swallow the click that follows a long press

  useMapEvents({
    click: (e) => {
      if (longPressed.current) {
        longPressed.current = false
        return
      }
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng })
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

function Fly({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15))
  }, [target, map])
  return null
}

function Fit({ line }) {
  const map = useMap()
  useEffect(() => {
    if (line?.length) map.fitBounds(L.latLngBounds(line), { padding: [60, 60] })
  }, [line, map])
  return null
}

export default function MapView({
  start, end, vias, route, memos, draft, selectedId, flyTo, picking,
  onMapClick, onSetPoint, onMovePoint, onSelectMemo, onUseAs, onRemove, onRemoveVia,
}) {
  // { pos: {lat,lng}, x, y } while the right-click menu is open
  const [menu, setMenu] = useState(null)

  const openMenu = useCallback((pos, point) => setMenu(pos ? { pos, x: point.x, y: point.y } : null), [])
  const choose = (kind) => {
    onSetPoint(kind, menu.pos)
    setMenu(null)
  }

  return (
    <div className="map-wrap">
      <MapContainer center={[37.5665, 126.978]} zoom={13} className={picking ? 'map picking' : 'map'}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents
          onClick={(pos) => {
            setMenu(null)
            onMapClick(pos)
          }}
          onContextMenu={openMenu}
        />
        <Fly target={flyTo} />
        <Fit line={route?.line} />

        {route && <Polyline positions={route.line} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.8 }} />}
        {start && <Marker position={[start.lat, start.lng]} icon={pin('#16a34a', 'A')} {...dragProps('start', start.id, onMovePoint)} />}
        {vias.map((v, i) => (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={pin('#f97316', i + 1)} {...dragProps('via', v.id, onMovePoint)}>
            <Popup>
              <strong>경유지 {i + 1}</strong>
              <div className="row small" style={{ marginTop: 6 }}>
                <button onClick={() => onRemoveVia(v.id)}>삭제</button>
              </div>
            </Popup>
          </Marker>
        ))}
        {end && <Marker position={[end.lat, end.lng]} icon={pin('#dc2626', 'B')} {...dragProps('end', end.id, onMovePoint)} />}
        {draft && <Marker position={[draft.lat, draft.lng]} icon={pin('#9ca3af', '+')} />}

        {memos.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pin(m.color, '✎')}
            zIndexOffset={m.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelectMemo(m.id) }}
          >
            {m.id === selectedId && (
              <Popup>
                <strong>{m.title}</strong>
                {m.text && <p style={{ margin: '4px 0' }}>{m.text}</p>}
                <div className="row small">
                  <button onClick={() => onUseAs(m, 'start')}>출발</button>
                  <button onClick={() => onUseAs(m, 'end')}>도착</button>
                  <button onClick={() => onRemove(m.id)}>삭제</button>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
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

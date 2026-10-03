import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const pin = (color, label = '') =>
  L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
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

export default function MapView({ start, end, route, memos, draft, selectedId, flyTo, picking, onMapClick, onSelectMemo, onUseAs, onRemove }) {
  return (
    <MapContainer center={[37.5665, 126.978]} zoom={13} className={picking ? 'map picking' : 'map'}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />
      <Fly target={flyTo} />
      <Fit line={route?.line} />

      {route && <Polyline positions={route.line} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.8 }} />}
      {start && <Marker position={[start.lat, start.lng]} icon={pin('#16a34a', 'A')} />}
      {end && <Marker position={[end.lat, end.lng]} icon={pin('#dc2626', 'B')} />}
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
  )
}

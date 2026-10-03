// Nominatim (OSM geocoding) + OSRM (OSM routing) public demo servers.
export async function searchPlaces(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=ko&q=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('검색에 실패했습니다.')
  const data = await res.json()
  return data.map((d) => ({ name: d.display_name, lat: +d.lat, lng: +d.lon }))
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ko&lat=${lat}&lon=${lng}`
    const res = await fetch(url)
    const d = await res.json()
    return d.display_name?.split(',').slice(0, 2).join(',').trim() || null
  } catch {
    return null
  }
}

// OSRM demo server supports only "driving"; the FOSSGIS servers support all three.
const SERVERS = {
  driving: 'https://routing.openstreetmap.de/routed-car',
  cycling: 'https://routing.openstreetmap.de/routed-bike',
  walking: 'https://routing.openstreetmap.de/routed-foot',
}

export async function getRoute(profile, points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${SERVERS[profile]}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error('경로를 찾지 못했습니다.')
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('경로를 찾지 못했습니다.')
  const r = data.routes[0]
  return {
    distance: r.distance,
    duration: r.duration,
    line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    steps: r.legs.flatMap((l, i) =>
      l.steps.map((s) => ({
        text: s.maneuver.type === 'arrive' && i < r.legs.length - 1 ? `경유지 ${i + 1} 도착` : describeStep(s),
        distance: s.distance,
      }))
    ),
  }
}

function describeStep(s) {
  const m = s.maneuver
  const road = s.name ? ` (${s.name})` : ''
  const dir = { left: '좌회전', right: '우회전', 'slight left': '약간 좌회전', 'slight right': '약간 우회전', 'sharp left': '급좌회전', 'sharp right': '급우회전', straight: '직진', uturn: 'U턴' }[m.modifier] || '직진'
  switch (m.type) {
    case 'depart': return `출발${road}`
    case 'arrive': return '도착'
    case 'roundabout':
    case 'rotary': return `회전교차로 진입${road}`
    default: return `${dir}${road}`
  }
}

export const fmtDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)
export const fmtDuration = (s) => {
  const min = Math.round(s / 60)
  if (min < 60) return `${min}분`
  return `${Math.floor(min / 60)}시간 ${min % 60}분`
}

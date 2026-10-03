const R = 6371000
const rad = (d) => (d * Math.PI) / 180

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Distance (m) from a point to the nearest vertex of a [lat,lng] polyline.
// OSRM geometries are dense enough that vertex distance is a good approximation.
export function distanceToLine(point, line) {
  let min = Infinity
  for (const [lat, lng] of line) {
    const d = haversine(point, { lat, lng })
    if (d < min) min = d
  }
  return min
}

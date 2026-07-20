import { ZONES, type ZoneKey } from '../constants/zones';

/** Ray-casting point-in-polygon test. */
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Reverse-maps GPS coordinates to a zone (Build Plan Section 10). Returns
 * null if no zone polygon matches (e.g. polygons not yet traced, or the
 * point falls outside all of them) — caller should fall back to manual
 * selection rather than blocking logging.
 */
export function lookupZone(lng: number, lat: number): ZoneKey | null {
  for (const zone of ZONES) {
    if (zone.polygon.length >= 3 && pointInPolygon([lng, lat], zone.polygon)) {
      return zone.key;
    }
  }
  return null;
}

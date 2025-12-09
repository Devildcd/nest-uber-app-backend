import type { Point } from 'geojson';

/**
 * Convierte lat/lng a GeoJSON Point (WGS84).
 * OJO: GeoJSON usa [lng, lat] (longitud primero).
 */
export function toGeoPoint(lat: number, lng: number, altitude?: number): Point {
  return {
    type: 'Point',
    coordinates:
      typeof altitude === 'number' ? [lng, lat, altitude] : [lng, lat],
  };
}

/** Extrae {lat,lng} desde un GeoJSON Point (o devuelve null si no es válido). */
export function fromGeoPoint(
  point?: Point | null,
): { lat: number; lng: number } | null {
  if (!point || point.type !== 'Point' || !Array.isArray(point.coordinates)) {
    return null;
  }
  const [lng, lat] = point.coordinates as [number, number];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

export function geoWgs84Expr() {
  return () => `ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography`;
}

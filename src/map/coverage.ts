import type { Coordinates } from '@/types/pcode';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

export function isCoordinateCovered(coordinates: Coordinates, bounds: LngLatBounds): boolean {
  const [west, south, east, north] = bounds;
  return (
    coordinates.longitude >= west &&
    coordinates.longitude <= east &&
    coordinates.latitude >= south &&
    coordinates.latitude <= north
  );
}

export function getOfflineCoverageState(
  coordinates: Coordinates,
  packs: { bounds: LngLatBounds; state: string }[],
): 'available' | 'unavailable' {
  return packs.some(
    (pack) => pack.state === 'complete' && isCoordinateCovered(coordinates, pack.bounds),
  )
    ? 'available'
    : 'unavailable';
}

export function isViewportCovered(
  viewport: LngLatBounds,
  packBounds: LngLatBounds,
): boolean {
  const [west, south, east, north] = viewport;
  const [packWest, packSouth, packEast, packNorth] = packBounds;
  return west >= packWest && south >= packSouth && east <= packEast && north <= packNorth;
}
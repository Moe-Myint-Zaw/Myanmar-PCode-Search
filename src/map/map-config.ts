import type { LngLatBounds } from '@maplibre/maplibre-react-native';
import type { StateRegionMapBounds } from '@/types/pcode';

export const MAX_OFFLINE_TILE_COUNT = 20_000;
export const STATE_REGION_MIN_ZOOM = 7;
export const STATE_REGION_MAX_ZOOM = 13;

export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE_URL;
export function isOfflineMapDownloadsEnabled(
  value: string | undefined,
  styleUrl: string,
): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return styleUrl === DEFAULT_MAP_STYLE_URL;
}
export const MAP_OFFLINE_DOWNLOADS_ENABLED = isOfflineMapDownloadsEnabled(
  process.env.EXPO_PUBLIC_MAP_OFFLINE_DOWNLOADS_ENABLED,
  MAP_STYLE_URL,
);

export type OfflineRegion = {
  id: string;
  name: string;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
  placeCount?: number;
  coordinateCount?: number;
};

export function isEquivalentOfflineRegion(
  region: OfflineRegion,
  pack: { bounds: LngLatBounds; minZoom: number | null; maxZoom: number | null },
): boolean {
  return (
    region.minZoom === pack.minZoom &&
    region.maxZoom === pack.maxZoom &&
    region.bounds.every((coordinate, index) => coordinate === pack.bounds[index])
  );
}

function longitudeToTile(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTile(latitude: number, zoom: number): number {
  const limitedLatitude = Math.max(-85.0511, Math.min(85.0511, latitude));
  const radians = (limitedLatitude * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom;
}

export function estimateOfflineTileCount(region: OfflineRegion): number {
  const [west, south, east, north] = region.bounds;
  let total = 0;
  for (let zoom = region.minZoom; zoom <= region.maxZoom; zoom += 1) {
    const xStart = Math.floor(longitudeToTile(west, zoom));
    const xEnd = Math.ceil(longitudeToTile(east, zoom));
    const yStart = Math.floor(latitudeToTile(north, zoom));
    const yEnd = Math.ceil(latitudeToTile(south, zoom));
    total += Math.max(1, xEnd - xStart) * Math.max(1, yEnd - yStart);
  }
  return total;
}

export function createStateRegionOfflineRegions(
  stateRegions: StateRegionMapBounds[],
): OfflineRegion[] {
  return stateRegions.map((region) => {
    const { west, south, east, north } = region;
    if (
      region.coordinate_count === 0 ||
      west === null ||
      south === null ||
      east === null ||
      north === null
    ) {
      throw new Error(`${region.sr_name} has no usable place coordinates for map coverage.`);
    }

    return {
      id: region.sr_pcode,
      name: region.sr_name,
      bounds: [west, south, east, north],
      minZoom: STATE_REGION_MIN_ZOOM,
      maxZoom: STATE_REGION_MAX_ZOOM,
      placeCount: region.place_count,
      coordinateCount: region.coordinate_count,
    };
  });
}
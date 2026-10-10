import type { Coordinates } from '@/types/pcode';

/**
 * Spatial grid index for efficient nearby place lookup.
 *
 * The Earth is divided into rectangular cells of configurable size (default 0.25 degrees).
 * Each place is assigned to a cell based on its coordinates. When searching for nearby places,
 * we only query places in the center cell and neighboring cells, avoiding full-table scans.
 *
 * Grid cell format: "latitude_cell:longitude_cell" (e.g., "78:384")
 */

export const DEFAULT_GRID_CELL_DEGREES = 0.25;
const KM_PER_DEGREE = 111.32;

export function getGridCellKey(
  coordinates: Coordinates,
  cellDegrees = DEFAULT_GRID_CELL_DEGREES,
): string {
  if (cellDegrees <= 0) throw new RangeError('Grid cell size must be positive.');
  return `${Math.floor(coordinates.latitude / cellDegrees)}:${Math.floor(
    coordinates.longitude / cellDegrees,
  )}`;
}

export function getGridCellKeysForRadius(
  coordinates: Coordinates,
  radiusKm: number,
  cellDegrees = DEFAULT_GRID_CELL_DEGREES,
): string[] {
  if (radiusKm < 0) throw new RangeError('Search radius cannot be negative.');
  if (cellDegrees <= 0) throw new RangeError('Grid cell size must be positive.');

  // Convert radius to degrees of latitude/longitude
  const latitudeDelta = radiusKm / KM_PER_DEGREE;
  // Longitude degrees vary with latitude (smaller near poles), so we scale by cosine
  const longitudeScale = Math.max(Math.cos((coordinates.latitude * Math.PI) / 180), 0.01);
  const longitudeDelta = radiusKm / (KM_PER_DEGREE * longitudeScale);

  // Calculate which grid cell the center point is in
  const centerLatitudeCell = Math.floor(coordinates.latitude / cellDegrees);
  const centerLongitudeCell = Math.floor(coordinates.longitude / cellDegrees);

  // Calculate how many grid cells in each direction to include
  const latitudeCellRange = Math.ceil(latitudeDelta / cellDegrees);
  const longitudeCellRange = Math.ceil(longitudeDelta / cellDegrees);

  // Collect all cell keys in the search radius
  const keys: string[] = [];

  for (
    let latitudeCell = centerLatitudeCell - latitudeCellRange;
    latitudeCell <= centerLatitudeCell + latitudeCellRange;
    latitudeCell += 1
  ) {
    for (
      let longitudeCell = centerLongitudeCell - longitudeCellRange;
      longitudeCell <= centerLongitudeCell + longitudeCellRange;
      longitudeCell += 1
    ) {
      keys.push(`${latitudeCell}:${longitudeCell}`);
    }
  }

  return keys;
}
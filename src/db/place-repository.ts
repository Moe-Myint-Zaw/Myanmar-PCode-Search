import type { SQLiteDatabase } from 'expo-sqlite';

import { sortSearchResults } from '@/services/search-ranking';
import { haversineDistanceKm } from '@/spatial/distance';
import { getGridCellKeysForRadius } from '@/spatial/grid';
import type {
    Coordinates,
    NearbyPlace,
    PlaceRecord,
    PlaceTypeFilter,
    StateRegionMapBounds,
} from '@/types/pcode';
import { normalizeSearchTerm } from '@/utils/normalize';

const DEFAULT_RESULT_LIMIT = 200;
const MAX_RESULT_LIMIT = 500;
const MAX_QUERY_LENGTH = 200; // Maximum search query length to prevent performance issues

// Whitelist of valid place type filters to prevent SQL injection
const VALID_PLACE_TYPE_FILTERS: readonly PlaceTypeFilter[] = ['all', 'State', 'Region', 'District', 'Township', 'Town', 'Ward', 'village', 'town'];

function validatePlaceTypeFilter(type: PlaceTypeFilter): PlaceTypeFilter {
  if (!VALID_PLACE_TYPE_FILTERS.includes(type)) {
    throw new Error(`Invalid place type filter: ${type}. Must be one of: ${VALID_PLACE_TYPE_FILTERS.join(', ')}`);
  }
  return type;
}

function validateSearchQuery(query: string): string {
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(`Search query is too long. Maximum length is ${MAX_QUERY_LENGTH} characters.`);
  }
  return query;
}

export function buildPlaceSearchSql(
  query: string,
  type: PlaceTypeFilter = 'all',
  limit = DEFAULT_RESULT_LIMIT,
): { sql: string; parameters: (string | number)[] } {
  const validatedQuery = validateSearchQuery(query);
  const validatedType = validatePlaceTypeFilter(type);
  const normalizedQuery = normalizeSearchTerm(validatedQuery);
  const pcodeQuery = normalizedQuery.replace(/\s+/g, '');
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), MAX_RESULT_LIMIT));
  const supportsTrigramSearch = Array.from(normalizedQuery).length >= 3;
  const typeClause = validatedType === 'all' ? '' : 'AND type = ?';
  const substringQuery = `%${normalizedQuery}%`;
  const candidateQueries = ['SELECT id FROM places WHERE pcode_normalized = ?'];
  const candidateParameters: (string | number)[] = [pcodeQuery];
  if (supportsTrigramSearch) {
    const postalPrefixInFts = pcodeQuery === normalizedQuery;
    candidateQueries.push(
      `SELECT places.id FROM places_name_fts
       INNER JOIN places ON places.id = places_name_fts.rowid
       WHERE places_name_fts MATCH ?
         AND (places.name_eng_normalized LIKE ? OR places.name_mmr_normalized LIKE ?
           OR places.tsp_name_normalized LIKE ?${
             postalPrefixInFts ? ' OR places.postal_code_normalized LIKE ?' : ''
           })`,
    );
    candidateParameters.push(
      `"${normalizedQuery.replace(/"/g, '""')}"`,
      substringQuery,
      substringQuery,
      substringQuery,
    );
    if (postalPrefixInFts) {
      candidateParameters.push(`${pcodeQuery}%`);
    } else {
      candidateQueries.push('SELECT id FROM places WHERE postal_code_normalized LIKE ?');
      candidateParameters.push(`${pcodeQuery}%`);
    }
  } else {
    candidateQueries.push('SELECT id FROM places WHERE postal_code_normalized LIKE ?');
    candidateParameters.push(`${pcodeQuery}%`);
    candidateQueries.push(
      `SELECT id FROM places WHERE name_eng_normalized LIKE ?
       OR name_mmr_normalized LIKE ? OR tsp_name_normalized LIKE ?`,
    );
    candidateParameters.push(substringQuery, substringQuery, substringQuery);
  }
  if (validatedType !== 'all') candidateParameters.push(validatedType);

  return {
    sql: `SELECT * FROM places
     WHERE id IN (${candidateQueries.join('\nUNION\n')})
       ${typeClause}
     ORDER BY CASE
       WHEN pcode_normalized = ? THEN 0
       WHEN postal_code_normalized = ? THEN 1
       WHEN name_eng_normalized = ? OR name_mmr_normalized = ? THEN 2
      WHEN postal_code_normalized LIKE ? OR name_eng_normalized LIKE ? OR name_mmr_normalized LIKE ? THEN 3
      WHEN name_eng_normalized LIKE ? OR name_mmr_normalized LIKE ? THEN 4
       WHEN tsp_name_normalized LIKE ? THEN 5
       ELSE 6 END,
       CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 0 ELSE 1 END,
       pcode ASC
     LIMIT ?`,
    parameters: [
      ...candidateParameters,
      pcodeQuery,
      pcodeQuery,
      normalizedQuery,
      normalizedQuery,
      `${normalizedQuery}%`,
      `${normalizedQuery}%`,
      `${normalizedQuery}%`,
      `%${normalizedQuery}%`,
      `%${normalizedQuery}%`,
      `%${normalizedQuery}%`,
      safeLimit,
    ],
  };
}

export async function searchPlaces(
  database: SQLiteDatabase,
  query: string,
  type: PlaceTypeFilter = 'all',
  limit = DEFAULT_RESULT_LIMIT,
): Promise<PlaceRecord[]> {
  const normalizedQuery = normalizeSearchTerm(query);
  if (!normalizedQuery) return [];

  try {
    const { sql, parameters } = buildPlaceSearchSql(normalizedQuery, type, limit);
    const rows = await database.getAllAsync<PlaceRecord>(sql, parameters);
    return sortSearchResults(rows, query);
  } catch (error) {
    // Return empty result on validation errors rather than crashing
    if (error instanceof Error && error.message.includes('too long')) {
      return [];
    }
    throw error;
  }
}

export async function getPlaceByPcode(
  database: SQLiteDatabase,
  pcode: string,
): Promise<PlaceRecord | null> {
  const normalizedPcode = normalizeSearchTerm(pcode).replace(/\s+/g, '');
  return database.getFirstAsync<PlaceRecord>(
    'SELECT * FROM places WHERE pcode_normalized = ?',
    normalizedPcode,
  );
}

export async function getPlaceHierarchy(
  database: SQLiteDatabase,
  pcode: string,
): Promise<PlaceRecord | null> {
  return getPlaceByPcode(database, pcode);
}

export async function getStateRegionMapBounds(
  database: SQLiteDatabase,
): Promise<StateRegionMapBounds[]> {
  return database.getAllAsync<StateRegionMapBounds>(
    `SELECT
       sr_pcode,
       sr_name,
       COUNT(*) AS place_count,
       COUNT(CASE
         WHEN lat BETWEEN -85.0511 AND 85.0511 AND lng BETWEEN -180 AND 180
         THEN 1
       END) AS coordinate_count,
       MIN(CASE
         WHEN lat BETWEEN -85.0511 AND 85.0511 AND lng BETWEEN -180 AND 180
         THEN lng
       END) AS west,
       MIN(CASE
         WHEN lat BETWEEN -85.0511 AND 85.0511 AND lng BETWEEN -180 AND 180
         THEN lat
       END) AS south,
       MAX(CASE
         WHEN lat BETWEEN -85.0511 AND 85.0511 AND lng BETWEEN -180 AND 180
         THEN lng
       END) AS east,
       MAX(CASE
         WHEN lat BETWEEN -85.0511 AND 85.0511 AND lng BETWEEN -180 AND 180
         THEN lat
       END) AS north
     FROM places
     WHERE sr_pcode IS NOT NULL AND sr_name IS NOT NULL
     GROUP BY sr_pcode, sr_name
     ORDER BY sr_name COLLATE NOCASE`,
  );
}

export async function findNearbyPlaces(
  database: SQLiteDatabase,
  coordinates: Coordinates,
  radiusKm = 25,
  limit = DEFAULT_RESULT_LIMIT,
): Promise<NearbyPlace[]> {
  if (radiusKm < 0) throw new RangeError('Search radius cannot be negative.');
  const cellKeys = getGridCellKeysForRadius(coordinates, radiusKm);
  const placeholders = cellKeys.map(() => '?').join(', ');
  const candidates = await database.getAllAsync<PlaceRecord>(
    `SELECT places.* FROM places
     INNER JOIN place_grid ON place_grid.place_id = places.id
     WHERE place_grid.cell_key IN (${placeholders})
       AND places.lat IS NOT NULL AND places.lng IS NOT NULL`,
    cellKeys,
  );

  return candidates
    .filter(
      (place): place is PlaceRecord & { lat: number; lng: number } =>
        place.lat !== null && place.lng !== null,
    )
    .map((place) => ({
      ...place,
      distance_km: haversineDistanceKm(coordinates, {
        latitude: place.lat,
        longitude: place.lng,
      }),
    }))
    .filter(({ distance_km }) => distance_km <= radiusKm)
    .sort((first, second) => first.distance_km - second.distance_km)
    .slice(0, Math.max(1, Math.min(Math.floor(limit), MAX_RESULT_LIMIT)));
}
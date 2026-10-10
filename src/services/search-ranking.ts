import type { PlaceRecord } from '@/types/pcode';
import { normalizeSearchTerm } from '@/utils/normalize';

/**
 * Search ranking according to project specification:
 * 0. Exact PCode match
 * 1. Exact postal code match
 * 2. Exact name match (English or Myanmar)
 * 3. Prefix match (postal code, English name, or Myanmar name)
 * 4. Substring match (English or Myanmar name)
 * 5. Township name match
 * 6. No match
 *
 * Tie-breaker: Places with coordinates rank higher than those without.
 */

export function getSearchRank(place: PlaceRecord, query: string): number {
  const normalizedQuery = normalizeSearchTerm(query);
  const pcode = normalizeSearchTerm(place.pcode);
  const postalCode = normalizeSearchTerm(place.postal_code ?? '');
  const englishName = normalizeSearchTerm(place.name_eng ?? '');
  const myanmarName = normalizeSearchTerm(place.name_mmr ?? '');
  const townshipName = normalizeSearchTerm(place.tsp_name ?? '');

  if (pcode === normalizedQuery) return 0;
  if (postalCode === normalizedQuery) return 1;
  if (englishName === normalizedQuery || myanmarName === normalizedQuery) return 2;
  if (
    postalCode.startsWith(normalizedQuery) ||
    englishName.startsWith(normalizedQuery) ||
    myanmarName.startsWith(normalizedQuery)
  ) {
    return 3;
  }
  if (englishName.includes(normalizedQuery) || myanmarName.includes(normalizedQuery)) {
    return 4;
  }
  if (townshipName.includes(normalizedQuery)) return 5;
  return 6;
}

export function sortSearchResults<T extends PlaceRecord>(items: T[], query: string): T[] {
  return [...items].sort((first, second) => {
    const rankDelta = getSearchRank(first, query) - getSearchRank(second, query);
    if (rankDelta !== 0) return rankDelta;

    const firstWithoutCoordinates = first.lat === null || first.lng === null ? 1 : 0;
    const secondWithoutCoordinates = second.lat === null || second.lng === null ? 1 : 0;
    return firstWithoutCoordinates - secondWithoutCoordinates;
  });
}
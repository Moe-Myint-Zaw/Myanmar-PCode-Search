import type { DatasetMetadata, PlaceInput } from '@/types/pcode';
import { validateDatasetMetadata } from './metadata';

export type CompactDataset = {
  metadata: DatasetMetadata;
  places: PlaceInput[];
};

const VALID_COORDINATE_SOURCES = new Set(['mimu', 'boundary', 'villages', 'town']);
const NULLABLE_TEXT_FIELDS = [
  'name_eng',
  'name_mmr',
  'sr_pcode',
  'sr_name',
  'district_pcode',
  'district_name',
  'tsp_pcode',
  'tsp_name',
  'town_pcode',
  'town_name',
  'vt_pcode',
  'vt_name',
  'coord_source',
  'postal_code',
] as const;

export function validateCompactDataset(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'Dataset must be a JSON object.';
  const candidate = value as { metadata?: unknown; places?: unknown };
  if (!candidate.metadata || !Array.isArray(candidate.places)) {
    return 'Dataset must contain metadata and a places array.';
  }

  if (typeof candidate.metadata !== 'object' || candidate.metadata === null) {
    return 'Dataset metadata is incomplete or invalid.';
  }
  const metadata = candidate.metadata as Partial<DatasetMetadata>;
  if (
    typeof metadata.datasetVersion !== 'string' ||
    typeof metadata.generatedAt !== 'string' ||
    typeof metadata.source !== 'string' ||
    typeof metadata.recordCount !== 'number' ||
    typeof metadata.schemaVersion !== 'number' ||
    typeof metadata.checksum !== 'string'
  ) {
    return 'Dataset metadata is incomplete or invalid.';
  }
  const metadataError = validateDatasetMetadata(metadata as DatasetMetadata, candidate.places.length);
  if (metadataError) return metadataError;

  const pcodes = new Set<string>();
  for (const place of candidate.places) {
    const placeError = validatePlaceInput(place);
    if (placeError) return placeError;
    const validPlace = place as PlaceInput;
    if (pcodes.has(validPlace.pcode)) return `Duplicate PCode: ${validPlace.pcode}`;
    pcodes.add(validPlace.pcode);
  }

  return null;
}

export function validatePlaceInput(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Every place must be an object.';
  const place = value as Partial<PlaceInput>;
  if (typeof place.type !== 'string' || !place.type.trim()) return 'Every place needs a type.';
  if (typeof place.pcode !== 'string' || !place.pcode.trim()) return 'Every place needs a PCode.';

  for (const field of NULLABLE_TEXT_FIELDS) {
    const fieldValue = place[field];
    if (fieldValue !== null && typeof fieldValue !== 'string') {
      return `Place ${place.pcode} has an invalid ${field} value.`;
    }
  }
  if (
    (place.lat !== null && typeof place.lat !== 'number') ||
    (place.lng !== null && typeof place.lng !== 'number')
  ) {
    return `Place ${place.pcode} has invalid coordinate values.`;
  }

  const hasLatitude = place.lat !== null;
  const hasLongitude = place.lng !== null;
  if (hasLatitude !== hasLongitude) return `Place ${place.pcode} has an incomplete coordinate pair.`;
  if (hasLatitude && hasLongitude) {
    if (
      typeof place.lat !== 'number' ||
      typeof place.lng !== 'number' ||
      !Number.isFinite(place.lat) ||
      !Number.isFinite(place.lng) ||
      place.lat < -90 ||
      place.lat > 90 ||
      place.lng < -180 ||
      place.lng > 180
    ) {
      return `Place ${place.pcode} has invalid coordinates.`;
    }
    if (typeof place.coord_source !== 'string' || !VALID_COORDINATE_SOURCES.has(place.coord_source)) {
      return `Place ${place.pcode} has an unsupported coordinate source.`;
    }
  } else if (
    place.coord_source !== null &&
    (typeof place.coord_source !== 'string' || !VALID_COORDINATE_SOURCES.has(place.coord_source))
  ) {
    return `Place ${place.pcode} has an unsupported coordinate source.`;
  }
  return null;
}
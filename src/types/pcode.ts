export type CoordinateSource = 'mimu' | 'boundary' | 'villages' | 'town';

export type PlaceTypeFilter =
  | 'all'
  | 'town'
  | 'ward'
  | 'village_tract'
  | 'village'
  | 'postal';

export type PlaceRecord = {
  id: number;
  type: string;
  pcode: string;
  name_eng: string | null;
  name_mmr: string | null;
  sr_pcode: string | null;
  sr_name: string | null;
  district_pcode: string | null;
  district_name: string | null;
  tsp_pcode: string | null;
  tsp_name: string | null;
  town_pcode: string | null;
  town_name: string | null;
  vt_pcode: string | null;
  vt_name: string | null;
  lat: number | null;
  lng: number | null;
  coord_source: CoordinateSource | null;
  postal_code: string | null;
};

export type PlaceInput = Omit<PlaceRecord, 'id'> & { id?: number };

export type DatasetMetadata = {
  datasetVersion: string;
  generatedAt: string;
  source: string;
  recordCount: number;
  schemaVersion: number;
  checksum: string;
};

export type DatasetStatus =
  | {
      state: 'ready';
      metadata: DatasetMetadata;
      installedAt: string;
      origin: 'bundled' | 'update' | 'installed';
      updatedAt: string;
    }
  | { state: 'missing' }
  | { state: 'invalid'; message: string };

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type StateRegionMapBounds = {
  sr_pcode: string;
  sr_name: string;
  place_count: number;
  coordinate_count: number;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
};

export type NearbyPlace = PlaceRecord & { distance_km: number };
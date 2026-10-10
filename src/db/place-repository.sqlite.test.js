const { DatabaseSync } = require('node:sqlite');
const { resolve } = require('node:path');
const { DATABASE_SCHEMA } = require('./schema');
const { getStateRegionMapBounds, searchPlaces } = require('./place-repository');
const {
  createStateRegionOfflineRegions,
  estimateOfflineTileCount,
  MAX_OFFLINE_TILE_COUNT,
} = require('../map/map-config');

function makePlace(overrides = {}) {
  const place = {
    type: 'village',
    pcode: 'MMR001001001',
    name_eng: 'Yangon East',
    name_mmr: 'ရန်ကုန်အရှေ့',
    sr_pcode: 'MMR001',
    sr_name: 'Yangon Region',
    district_pcode: 'MMR001001',
    district_name: 'East Yangon',
    tsp_pcode: 'MMR001001001',
    tsp_name: 'Yangon Township',
    town_pcode: null,
    town_name: null,
    vt_pcode: null,
    vt_name: null,
    lat: 16.8,
    lng: 96.1,
    coord_source: 'mimu',
    postal_code: '11221',
    ...overrides,
  };
  const normalized = (value) => (value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
  return [
    place.type,
    place.pcode,
    place.name_eng,
    place.name_mmr,
    place.sr_pcode,
    place.sr_name,
    place.district_pcode,
    place.district_name,
    place.tsp_pcode,
    place.tsp_name,
    place.town_pcode,
    place.town_name,
    place.vt_pcode,
    place.vt_name,
    place.lat,
    place.lng,
    place.coord_source,
    place.postal_code,
    normalized(place.pcode).replace(/\s+/g, ''),
    normalized(place.postal_code).replace(/\s+/g, ''),
    normalized(place.name_eng),
    normalized(place.name_mmr),
    normalized(place.tsp_name),
  ];
}

describe('SQLite place repository integration', () => {
  let sqlite;
  let repositoryDatabase;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(DATABASE_SCHEMA);
    const insert = sqlite.prepare(`INSERT INTO places (
      type, pcode, name_eng, name_mmr, sr_pcode, sr_name, district_pcode, district_name,
      tsp_pcode, tsp_name, town_pcode, town_name, vt_pcode, vt_name, lat, lng,
      coord_source, postal_code, pcode_normalized, postal_code_normalized,
      name_eng_normalized, name_mmr_normalized, tsp_name_normalized
    ) VALUES (${Array.from({ length: 23 }, () => '?').join(', ')})`);
    insert.run(...makePlace());
    insert.run(...makePlace({
      pcode: 'MMR001001002',
      name_eng: 'Yangon West',
      name_mmr: 'ရန်ကုန်အနောက်',
      tsp_name: 'Yangon',
      postal_code: '11229',
      lat: null,
      lng: null,
      coord_source: null,
    }));
    repositoryDatabase = {
      getAllAsync: async (sql, parameters) => sqlite.prepare(sql).all(...parameters),
    };
  });

  afterEach(() => sqlite.close());

  it('returns exact PCode matches from the real schema', async () => {
    const results = await searchPlaces(repositoryDatabase, 'MMR001001001');
    expect(results.map((place) => place.pcode)).toEqual(['MMR001001001']);
  });

  it('returns supported partial postal-code matches', async () => {
    const results = await searchPlaces(repositoryDatabase, '1122');
    const spacedResults = await searchPlaces(repositoryDatabase, '11 22');

    expect(results.map((place) => place.postal_code)).toEqual(['11221', '11229']);
    expect(spacedResults.map((place) => place.postal_code)).toEqual(['11221', '11229']);
  });

  it('searches the packaged dataset by postal code with the postal filter selected', async () => {
    const packagedDatabase = new DatabaseSync(
      resolve(process.cwd(), 'assets/database/myanmar_pcode.db'),
    );
    const packagedRepository = {
      getAllAsync: async (sql, parameters) => packagedDatabase.prepare(sql).all(...parameters),
    };

    try {
      const exactResults = await searchPlaces(packagedRepository, '0101200', 'postal');
      const partialResults = await searchPlaces(packagedRepository, '01012', 'postal');

      expect(exactResults.map((place) => place.pcode)).toContain('MMR001001001');
      expect(exactResults.every((place) => place.postal_code !== null)).toBe(true);
      expect(partialResults.length).toBeGreaterThan(0);
      expect(partialResults.every((place) => place.postal_code !== null)).toBe(true);
    } finally {
      packagedDatabase.close();
    }
  });

  it('searches Myanmar normalized names and preserves useful indexes', async () => {
    const results = await searchPlaces(repositoryDatabase, 'ရန်ကုန်');
    const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(({ name }) => name);
    expect(results).toHaveLength(2);
    expect(indexes).toContain('places_postal_code_idx');
    expect(indexes).toContain('place_grid_cell_idx');
  });

  it('finds substrings in names and townships through the trigram index', async () => {
    const results = await searchPlaces(repositoryDatabase, 'gon');
    const townshipOnlyResults = await searchPlaces(repositoryDatabase, 'township');

    expect(results.map((place) => place.pcode)).toEqual([
      'MMR001001001',
      'MMR001001002',
    ]);
    expect(townshipOnlyResults.map((place) => place.pcode)).toEqual([
      'MMR001001001',
    ]);
  });

  it('keeps the trigram index synchronized when indexed names change', async () => {
    sqlite.prepare(
      `UPDATE places SET name_eng_normalized = ?, tsp_name_normalized = ? WHERE pcode = ?`,
    ).run('changed name', 'changed township', 'MMR001001001');

    const oldResults = await searchPlaces(repositoryDatabase, 'yang');
    const newResults = await searchPlaces(repositoryDatabase, 'changed');

    expect(oldResults.map((place) => place.pcode)).toEqual(['MMR001001002']);
    expect(newResults.map((place) => place.pcode)).toEqual(['MMR001001001']);
  });

  it('searches the packaged dataset through its built trigram index', async () => {
    const packagedDatabase = new DatabaseSync(
      resolve(process.cwd(), 'assets/database/myanmar_pcode.db'),
    );
    const packagedRepository = {
      getAllAsync: async (sql, parameters) => packagedDatabase.prepare(sql).all(...parameters),
    };

    try {
      const results = await searchPlaces(packagedRepository, 'Taungoo', 'all', 20);

      expect(results).toHaveLength(20);
      expect(
        results.every((place) =>
          `${place.name_eng ?? ''} ${place.name_mmr ?? ''} ${place.tsp_name ?? ''}`
            .toLocaleLowerCase()
            .includes('taungoo'),
        ),
      ).toBe(true);
    } finally {
      packagedDatabase.close();
    }
  });

  it('searches packaged village tracts by name when the village-tract filter is selected', async () => {
    const packagedDatabase = new DatabaseSync(
      resolve(process.cwd(), 'assets/database/myanmar_pcode.db'),
    );
    const packagedRepository = {
      getAllAsync: async (sql, parameters) => packagedDatabase.prepare(sql).all(...parameters),
    };

    try {
      const results = await searchPlaces(packagedRepository, 'Alam', 'village_tract');

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((place) => place.type === 'village_tract')).toBe(true);
      expect(results.some((place) => place.name_eng === 'Alam')).toBe(true);
    } finally {
      packagedDatabase.close();
    }
  });

  it('returns every State/Region in the packaged dataset with coordinate-derived map bounds', async () => {
    const packagedDatabase = new DatabaseSync(
      resolve(process.cwd(), 'assets/database/myanmar_pcode.db'),
    );
    const packagedRepository = {
      getAllAsync: async (sql) => packagedDatabase.prepare(sql).all(),
    };

    try {
      const stateRegions = await getStateRegionMapBounds(packagedRepository);
      const offlineRegions = createStateRegionOfflineRegions(stateRegions);
      const distinctRegionCodes = new Set(stateRegions.map(({ sr_pcode }) => sr_pcode));

      expect(offlineRegions).toHaveLength(distinctRegionCodes.size);
      expect(offlineRegions.length).toBeGreaterThan(0);
      expect(offlineRegions.every((region) => region.coordinateCount > 0)).toBe(true);
      expect(
        offlineRegions.every(
          (region) => estimateOfflineTileCount(region) <= MAX_OFFLINE_TILE_COUNT,
        ),
      ).toBe(true);
    } finally {
      packagedDatabase.close();
    }
  });

  it('enforces unique PCodes in SQLite', () => {
    const insert = sqlite.prepare(`INSERT INTO places (
      type, pcode, pcode_normalized, postal_code_normalized, name_eng_normalized,
      name_mmr_normalized, tsp_name_normalized
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    expect(() => insert.run('village', 'MMR001001001', 'MMR001001001', '', '', '', '')).toThrow();
  });
});
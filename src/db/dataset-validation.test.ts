import { validateCompactDataset, type CompactDataset } from './dataset-validation';

const dataset: CompactDataset = {
  metadata: {
    datasetVersion: '9.7',
    generatedAt: '2026-01-01T00:00:00.000Z',
    source: 'MIMU + Myanmar Postal Code + OCHA',
    recordCount: 1,
    schemaVersion: 1,
    checksum: 'a'.repeat(64),
  },
  places: [
    {
      type: 'village',
      pcode: 'MMR001001001',
      name_eng: 'Yangon',
      name_mmr: 'ရန်ကုန်',
      sr_pcode: null,
      sr_name: null,
      district_pcode: null,
      district_name: null,
      tsp_pcode: null,
      tsp_name: null,
      town_pcode: null,
      town_name: null,
      vt_pcode: null,
      vt_name: null,
      lat: 16.8,
      lng: 96.1,
      coord_source: 'mimu',
      postal_code: null,
    },
  ],
};

describe('validateCompactDataset', () => {
  it('accepts a schema-complete record with a known coordinate source', () => {
    expect(validateCompactDataset(dataset)).toBeNull();
  });

  it('rejects duplicate PCodes', () => {
    expect(
      validateCompactDataset({ ...dataset, metadata: { ...dataset.metadata, recordCount: 2 }, places: [...dataset.places, dataset.places[0]] }),
    ).toContain('Duplicate PCode');
  });

  it('rejects an invented coordinate source', () => {
    expect(
      validateCompactDataset({
        ...dataset,
        places: [{ ...dataset.places[0], coord_source: 'surveyed' }],
      }),
    ).toContain('unsupported coordinate source');
  });

  it('rejects incomplete coordinate pairs', () => {
    expect(
      validateCompactDataset({
        ...dataset,
        places: [{ ...dataset.places[0], lng: null }],
      }),
    ).toContain('incomplete coordinate pair');
  });

  it('rejects missing optional schema fields instead of passing undefined to SQLite', () => {
    const { coord_source: _coordSource, ...incompletePlace } = dataset.places[0];
    expect(validateCompactDataset({ ...dataset, places: [incompletePlace] })).toContain(
      'invalid coord_source',
    );
  });
});
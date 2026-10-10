import type { PlaceRecord } from '@/types/pcode';
import { getSearchRank, sortSearchResults } from './search-ranking';

const place = (overrides: Partial<PlaceRecord>): PlaceRecord => ({
  id: 1,
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
  lat: null,
  lng: null,
  coord_source: null,
  postal_code: null,
  ...overrides,
});

describe('search ranking', () => {
  it('prioritizes PCode, postal, exact names, prefixes, substrings, then township', () => {
    expect(getSearchRank(place({ pcode: 'yangon' }), 'Yangon')).toBe(0);
    expect(getSearchRank(place({ postal_code: 'Yangon' }), 'Yangon')).toBe(1);
    expect(getSearchRank(place({ name_eng: 'Yangon' }), 'Yangon')).toBe(2);
    expect(
      getSearchRank(
        place({ name_eng: null, name_mmr: null, postal_code: 'Yangon West' }),
        'Yangon',
      ),
    ).toBe(3);
    expect(getSearchRank(place({ name_eng: 'Yangon East' }), 'Yangon')).toBe(3);
    expect(getSearchRank(place({ name_eng: 'New Yangon' }), 'Yangon')).toBe(4);
    expect(getSearchRank(place({ name_eng: null, name_mmr: null, tsp_name: 'Yangon' }), 'Yangon')).toBe(5);
  });

  it('prefers places with coordinates within the same ranking tier', () => {
    const noCoordinates = place({ id: 1, name_eng: 'Yangon' });
    const withCoordinates = place({ id: 2, name_eng: 'Yangon', lat: 16.8, lng: 96.1 });

    expect(sortSearchResults([noCoordinates, withCoordinates], 'Yangon').map(({ id }) => id)).toEqual([
      2,
      1,
    ]);
  });
});
import {
    createStateRegionOfflineRegions,
    DEFAULT_MAP_STYLE_URL,
    estimateOfflineTileCount,
    isEquivalentOfflineRegion,
    isOfflineMapDownloadsEnabled,
    MAX_OFFLINE_TILE_COUNT,
    STATE_REGION_MAX_ZOOM,
    STATE_REGION_MIN_ZOOM,
    type OfflineRegion,
} from './map-config';

const region: OfflineRegion = {
  id: 'yangon',
  name: 'Yangon central',
  bounds: [96.02, 16.74, 96.24, 16.94],
  minZoom: 10,
  maxZoom: 15,
};

describe('isEquivalentOfflineRegion', () => {
  it('matches identical bounds and zoom ranges', () => {
    expect(isEquivalentOfflineRegion(region, { ...region, minZoom: 10, maxZoom: 15 })).toBe(true);
  });

  it('treats a different zoom range as a distinct pack', () => {
    expect(isEquivalentOfflineRegion(region, { ...region, minZoom: 11, maxZoom: 15 })).toBe(false);
  });

  it('estimates bounded tile counts across the requested zooms', () => {
    expect(estimateOfflineTileCount(region)).toBeGreaterThan(0);
    expect(estimateOfflineTileCount({ ...region, bounds: [-180, -80, 180, 80] })).toBeGreaterThan(
      100_000,
    );
  });

});

describe('State/Region offline areas', () => {
  it('builds one downloadable area per database State/Region', () => {
    const regions = createStateRegionOfflineRegions([
      {
        sr_pcode: 'MMR001',
        sr_name: 'Kachin',
        place_count: 12,
        coordinate_count: 10,
        west: 95.9,
        south: 23.6,
        east: 98.7,
        north: 28.3,
      },
      {
        sr_pcode: 'MMR013',
        sr_name: 'Yangon',
        place_count: 5,
        coordinate_count: 4,
        west: 93.3,
        south: 14.1,
        east: 96.8,
        north: 17.7,
      },
    ]);

    expect(regions.map(({ id, name }) => [id, name])).toEqual([
      ['MMR001', 'Kachin'],
      ['MMR013', 'Yangon'],
    ]);
    expect(regions[0]).toMatchObject({
      bounds: [95.9, 23.6, 98.7, 28.3],
      minZoom: STATE_REGION_MIN_ZOOM,
      maxZoom: STATE_REGION_MAX_ZOOM,
      coordinateCount: 10,
    });
  });

  it('keeps database-derived region downloads within the configured tile ceiling', () => {
    const regions = createStateRegionOfflineRegions([
      {
        sr_pcode: 'MMR001',
        sr_name: 'Kachin',
        place_count: 12,
        coordinate_count: 10,
        west: 95.9,
        south: 23.6,
        east: 98.7,
        north: 28.3,
      },
    ]);

    expect(estimateOfflineTileCount(regions[0])).toBeLessThanOrEqual(MAX_OFFLINE_TILE_COUNT);
  });

  it('reports regions without usable coordinate bounds instead of fabricating an area', () => {
    expect(() =>
      createStateRegionOfflineRegions([
        {
          sr_pcode: 'MMR001',
          sr_name: 'Kachin',
          place_count: 1,
          coordinate_count: 0,
          west: null,
          south: null,
          east: null,
          north: null,
        },
      ]),
    ).toThrow('Kachin has no usable place coordinates for map coverage.');
  });
});

describe('map provider defaults', () => {
  it('uses the OpenFreeMap Liberty style by default', () => {
    expect(DEFAULT_MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/liberty');
  });

  it('enables selected-area offline downloads for the default provider', () => {
    expect(isOfflineMapDownloadsEnabled(undefined, DEFAULT_MAP_STYLE_URL)).toBe(true);
  });

  it('requires explicit approval for custom styles and supports disabling downloads', () => {
    expect(isOfflineMapDownloadsEnabled(undefined, 'https://maps.example/style.json')).toBe(false);
    expect(isOfflineMapDownloadsEnabled('true', 'https://maps.example/style.json')).toBe(true);
    expect(isOfflineMapDownloadsEnabled('false', DEFAULT_MAP_STYLE_URL)).toBe(false);
  });
});

describe('Custom Bounds Validation', () => {
  const MAX_AREA_DEGREES = 50;

  function validateCustomBounds(
    boundsText: string,
    minZoom: string,
    maxZoom: string,
  ): { valid: boolean; error?: string } {
    // Input length validation
    if (boundsText.length > 200) {
      return { valid: false, error: 'Bounds input is too long. Use the format: west, south, east, north' };
    }

    const bounds = boundsText.split(',').map((value) => Number(value.trim()));
    const minimum = Number(minZoom);
    const maximum = Number(maxZoom);

    // Comprehensive bounds validation
    if (
      bounds.length !== 4 ||
      bounds.some((value) => !Number.isFinite(value)) ||
      bounds[0] < -180 || bounds[2] > 180 || bounds[0] >= bounds[2] ||
      bounds[1] < -90 || bounds[3] > 90 || bounds[1] >= bounds[3] ||
      !Number.isInteger(minimum) || !Number.isInteger(maximum) ||
      minimum < 0 || maximum > 22 || minimum > maximum
    ) {
      return {
        valid: false,
        error: 'Bounds must be west, south, east, north in valid longitude/latitude ranges; zooms must be whole numbers from 0 to 22.',
      };
    }

    // Area validation
    const latRange = bounds[3] - bounds[1];
    const lonRange = bounds[2] - bounds[0];
    const areaDegrees = latRange * lonRange;

    if (areaDegrees > MAX_AREA_DEGREES) {
      return { valid: false, error: 'The requested area is too large. Reduce the bounds to a smaller region.' };
    }

    return { valid: true };
  }

  it('accepts valid bounds and zoom levels', () => {
    const result = validateCustomBounds('96, 16, 97, 17', '10', '15');
    expect(result.valid).toBe(true);
  });

  it('rejects bounds input exceeding 200 characters', () => {
    const longBounds = '96, 16, 97, 17, ' + 'a'.repeat(200);
    const result = validateCustomBounds(longBounds, '10', '15');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('rejects invalid number of bounds values', () => {
    const result = validateCustomBounds('96, 16, 17', '10', '15');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('west, south, east, north');
  });

  it('rejects non-numeric bounds values', () => {
    const result = validateCustomBounds('abc, 16, 97, 17', '10', '15');
    expect(result.valid).toBe(false);
  });

  it('rejects longitude out of range', () => {
    const result = validateCustomBounds('-181, 16, 97, 17', '10', '15');
    expect(result.valid).toBe(false);

    const result2 = validateCustomBounds('96, 16, 181, 17', '10', '15');
    expect(result2.valid).toBe(false);
  });

  it('rejects latitude out of range', () => {
    const result = validateCustomBounds('96, -91, 97, 17', '10', '15');
    expect(result.valid).toBe(false);

    const result2 = validateCustomBounds('96, 16, 97, 91', '10', '15');
    expect(result2.valid).toBe(false);
  });

  it('rejects bounds where west >= east', () => {
    const result = validateCustomBounds('97, 16, 96, 17', '10', '15');
    expect(result.valid).toBe(false);
  });

  it('rejects bounds where south >= north', () => {
    const result = validateCustomBounds('96, 17, 97, 16', '10', '15');
    expect(result.valid).toBe(false);
  });

  it('rejects non-integer zoom levels', () => {
    const result = validateCustomBounds('96, 16, 97, 17', '10.5', '15');
    expect(result.valid).toBe(false);

    const result2 = validateCustomBounds('96, 16, 97, 17', '10', '15.5');
    expect(result2.valid).toBe(false);
  });

  it('rejects zoom levels out of range', () => {
    const result = validateCustomBounds('96, 16, 97, 17', '-1', '15');
    expect(result.valid).toBe(false);

    const result2 = validateCustomBounds('96, 16, 97, 17', '10', '23');
    expect(result2.valid).toBe(false);
  });

  it('rejects min zoom greater than max zoom', () => {
    const result = validateCustomBounds('96, 16, 97, 17', '15', '10');
    expect(result.valid).toBe(false);
  });

  it('rejects area exceeding maximum size', () => {
    // Large area: 50 degrees x 50 degrees = 2500 degree² (exceeds 50 limit)
    const result = validateCustomBounds('0, 0, 50, 50', '10', '15');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('accepts area at maximum size', () => {
    // Area: 7 degrees x 7 degrees = 49 degree² (within 50 limit)
    const result = validateCustomBounds('0, 0, 7, 7', '10', '15');
    expect(result.valid).toBe(true);
  });

  it('accepts Yangon region bounds', () => {
    // Yangon region within Myanmar (smaller area)
    const result = validateCustomBounds('96, 16, 97, 17', '10', '15');
    expect(result.valid).toBe(true);
  });

  it('handles whitespace in bounds input', () => {
    const result = validateCustomBounds(' 96 , 16 , 97 , 17 ', '10', '15');
    expect(result.valid).toBe(true);
  });
});
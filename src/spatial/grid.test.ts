import { getGridCellKey, getGridCellKeysForRadius } from './grid';

describe('spatial grid', () => {
  it('maps coordinates to stable degree-sized cells', () => {
    expect(getGridCellKey({ latitude: 16.8, longitude: 96.1 })).toBe('67:384');
  });

  it('includes neighboring cells for a non-zero search radius', () => {
    const keys = getGridCellKeysForRadius({ latitude: 16.8, longitude: 96.1 }, 20);
    expect(keys).toContain(getGridCellKey({ latitude: 16.8, longitude: 96.1 }));
    expect(keys.length).toBeGreaterThan(1);
  });
});
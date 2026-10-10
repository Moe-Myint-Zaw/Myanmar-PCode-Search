import { haversineDistanceKm } from './distance';

describe('haversineDistanceKm', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineDistanceKm({ latitude: 16, longitude: 96 }, { latitude: 16, longitude: 96 })).toBe(0);
  });

  it('calculates a one-degree latitude arc', () => {
    expect(
      haversineDistanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
      ),
    ).toBeCloseTo(111.195, 2);
  });
});
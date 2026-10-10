import { getOfflineCoverageState, isCoordinateCovered, isViewportCovered } from './coverage';

const yangonBounds: [number, number, number, number] = [96, 16.7, 96.3, 17];

describe('offline map coverage', () => {
  it('checks whether a coordinate lies in downloaded bounds', () => {
    expect(isCoordinateCovered({ latitude: 16.8, longitude: 96.1 }, yangonBounds)).toBe(true);
    expect(isCoordinateCovered({ latitude: 22, longitude: 96.1 }, yangonBounds)).toBe(false);
  });

  it('requires the full viewport to be inside a complete pack', () => {
    expect(isViewportCovered([96.1, 16.8, 96.2, 16.9], yangonBounds)).toBe(true);
    expect(isViewportCovered([95.9, 16.8, 96.2, 16.9], yangonBounds)).toBe(false);
    expect(getOfflineCoverageState({ latitude: 16.8, longitude: 96.1 }, [
      { bounds: yangonBounds, state: 'complete' },
    ])).toBe('available');
  });
});
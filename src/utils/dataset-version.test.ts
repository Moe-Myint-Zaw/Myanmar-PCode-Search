import { compareDatasetVersions } from './dataset-version';

describe('compareDatasetVersions', () => {
  it('compares numeric segments rather than lexical order', () => {
    expect(compareDatasetVersions('9.10', '9.7')).toBe(1);
    expect(compareDatasetVersions('10.0', '9.99')).toBe(1);
  });

  it('treats missing trailing zeros as equal', () => {
    expect(compareDatasetVersions('9.7.0', '9.7')).toBe(0);
  });

  it('rejects non-numeric version metadata', () => {
    expect(() => compareDatasetVersions('latest', '9.7')).toThrow(TypeError);
  });
});
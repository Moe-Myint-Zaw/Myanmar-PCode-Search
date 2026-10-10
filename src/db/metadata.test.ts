import type { DatasetMetadata } from '@/types/pcode';
import { validateDatasetMetadata } from './metadata';

const metadata: DatasetMetadata = {
  datasetVersion: '9.7',
  generatedAt: '2026-01-01T00:00:00.000Z',
  source: 'MIMU + Myanmar Postal Code + OCHA',
  recordCount: 1,
  schemaVersion: 1,
  checksum: 'a'.repeat(64),
};

describe('validateDatasetMetadata', () => {
  it('accepts valid metadata with a matching count and SHA-256 checksum', () => {
    expect(validateDatasetMetadata(metadata, 1)).toBeNull();
  });

  it('rejects a mismatched record count', () => {
    expect(validateDatasetMetadata(metadata, 2)).toContain('record count');
  });

  it('rejects unknown coordinate source semantics at the schema layer', () => {
    expect(validateDatasetMetadata({ ...metadata, schemaVersion: 2 }, 1)).toContain(
      'schema version',
    );
  });
});
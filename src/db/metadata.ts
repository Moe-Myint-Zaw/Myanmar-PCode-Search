import type { SQLiteDatabase } from 'expo-sqlite';

import type { DatasetMetadata, DatasetStatus } from '@/types/pcode';

const DATASET_SCHEMA_VERSION = 1;

export type DatasetMetadataInput = DatasetMetadata;

export function validateDatasetMetadata(
  metadata: DatasetMetadataInput,
  actualRecordCount: number,
): string | null {
  if (!metadata.datasetVersion.trim()) return 'Dataset version is required.';
  if (!Number.isFinite(Date.parse(metadata.generatedAt))) return 'Generated date is invalid.';
  if (!metadata.source.trim()) return 'Dataset source is required.';
  if (!Number.isInteger(metadata.recordCount) || metadata.recordCount <= 0) {
    return 'Dataset record count must be a positive integer.';
  }
  if (metadata.recordCount !== actualRecordCount) return 'Dataset record count does not match.';
  if (metadata.schemaVersion !== DATASET_SCHEMA_VERSION) return 'Dataset schema version is unsupported.';
  if (!/^[a-f\d]{64}$/i.test(metadata.checksum)) return 'Dataset checksum must be a SHA-256 digest.';
  return null;
}

export async function getDatasetStatus(database: SQLiteDatabase): Promise<DatasetStatus> {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM dataset_metadata',
  );
  const values = new Map(rows.map(({ key, value }) => [key, value]));
  const version = values.get('datasetVersion');
  if (!version) return { state: 'missing' };

  const recordCountRow = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM places',
  );
  const metadata: DatasetMetadata = {
    datasetVersion: version,
    generatedAt: values.get('generatedAt') ?? '',
    source: values.get('source') ?? '',
    recordCount: Number(values.get('recordCount')),
    schemaVersion: Number(values.get('schemaVersion')),
    checksum: values.get('checksum') ?? '',
  };
  const validationMessage = validateDatasetMetadata(metadata, recordCountRow?.count ?? 0);

  if (validationMessage) return { state: 'invalid', message: validationMessage };

  const origin = values.get('datasetOrigin');
  return {
    state: 'ready',
    metadata,
    installedAt: values.get('installedAt') ?? '',
    origin: origin === 'bundled' || origin === 'update' ? origin : 'installed',
    updatedAt: values.get('updatedAt') ?? '',
  };
}
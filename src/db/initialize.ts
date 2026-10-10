import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatasetStatus } from './metadata';
import { AppError } from '@/types/errors';
import { DATABASE_SCHEMA_VERSION } from './schema';

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  const status = await getDatasetStatus(database);
  if (status.state !== 'ready') {
    throw new AppError(
      'DATABASE_CORRUPTED',
      status.state === 'invalid'
        ? status.message
        : 'The database does not contain the built-in place dataset.',
    );
  }

  const schemaVersion = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  if (schemaVersion?.user_version !== DATABASE_SCHEMA_VERSION) {
    throw new AppError('DATABASE_CORRUPTED', 'The bundled database schema version is unsupported.');
  }

  const integrity = await database.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check',
  );
  if (integrity?.integrity_check !== 'ok') {
    throw new AppError('DATABASE_CORRUPTED', 'SQLite integrity validation failed.');
  }

  const indexes = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index'",
  );
  const indexNames = new Set(indexes.map(({ name }) => name));
  for (const index of [
    'places_pcode_idx',
    'places_postal_code_idx',
    'places_type_idx',
    'places_tsp_pcode_idx',
    'places_town_pcode_idx',
    'places_vt_pcode_idx',
    'place_grid_cell_idx',
  ]) {
    if (!indexNames.has(index)) {
      throw new AppError('DATABASE_CORRUPTED', `Required database index is missing: ${index}.`);
    }
  }

  const searchObjects = await database.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE name IN (
       'places_name_fts',
       'places_name_fts_insert',
       'places_name_fts_update',
       'places_name_fts_delete'
     )`,
  );
  const searchObjectNames = new Set(searchObjects.map(({ name }) => name));
  for (const name of [
    'places_name_fts',
    'places_name_fts_insert',
    'places_name_fts_update',
    'places_name_fts_delete',
  ]) {
    if (!searchObjectNames.has(name)) {
      throw new AppError('DATABASE_CORRUPTED', `Required place search object is missing: ${name}.`);
    }
  }

  const installedAt = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO dataset_metadata (key, value) VALUES ('installedAt', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value = ''`,
    installedAt,
  );
  await database.runAsync(
    "INSERT OR IGNORE INTO dataset_metadata (key, value) VALUES ('datasetOrigin', 'installed')",
  );
}
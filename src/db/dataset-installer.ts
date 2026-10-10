import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getGridCellKey } from '@/spatial/grid';
import { AppError } from '@/types/errors';
import type { PlaceInput } from '@/types/pcode';
import { normalizeSearchTerm } from '@/utils/normalize';
import { validateCompactDataset, type CompactDataset } from './dataset-validation';
import { DATABASE_SCHEMA_VERSION } from './schema';

const MAX_DATASET_JSON_SIZE = 100 * 1024 * 1024; // 100MB max dataset size
const TRANSACTION_BATCH_SIZE = 100; // Process places in batches

const PLACE_COLUMNS = `(
  type, pcode, name_eng, name_mmr, sr_pcode, sr_name, district_pcode, district_name,
  tsp_pcode, tsp_name, town_pcode, town_name, vt_pcode, vt_name, lat, lng,
  coord_source, postal_code, pcode_normalized, postal_code_normalized,
  name_eng_normalized, name_mmr_normalized, tsp_name_normalized
)`;
const PLACE_INSERT_SQL = `INSERT INTO places ${PLACE_COLUMNS} VALUES (${Array.from({ length: 23 }, () => '?').join(', ')})`;

function normalizedCode(value: string | null): string {
  return normalizeSearchTerm(value ?? '').replace(/\s+/g, '');
}

function placeValues(place: PlaceInput): (string | number | null)[] {
  return [
    place.type,
    place.pcode,
    place.name_eng,
    place.name_mmr,
    place.sr_pcode,
    place.sr_name,
    place.district_pcode,
    place.district_name,
    place.tsp_pcode,
    place.tsp_name,
    place.town_pcode,
    place.town_name,
    place.vt_pcode,
    place.vt_name,
    place.lat,
    place.lng,
    place.coord_source,
    place.postal_code,
    normalizedCode(place.pcode),
    normalizedCode(place.postal_code),
    normalizeSearchTerm(place.name_eng ?? ''),
    normalizeSearchTerm(place.name_mmr ?? ''),
    normalizeSearchTerm(place.tsp_name ?? ''),
  ];
}

async function persistDataset(database: SQLiteDatabase, dataset: CompactDataset): Promise<void> {
  const installedAt = new Date().toISOString();

  // Step 1: Create staging tables if they don't exist
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS places_staging (
      type TEXT NOT NULL,
      pcode TEXT NOT NULL,
      name_eng TEXT,
      name_mmr TEXT,
      sr_pcode TEXT,
      sr_name TEXT,
      district_pcode TEXT,
      district_name TEXT,
      tsp_pcode TEXT,
      tsp_name TEXT,
      town_pcode TEXT,
      town_name TEXT,
      vt_pcode TEXT,
      vt_name TEXT,
      lat REAL,
      lng REAL,
      coord_source TEXT,
      postal_code TEXT,
      pcode_normalized TEXT NOT NULL,
      postal_code_normalized TEXT NOT NULL,
      name_eng_normalized TEXT NOT NULL,
      name_mmr_normalized TEXT NOT NULL,
      tsp_name_normalized TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS place_grid_staging (
      cell_key TEXT NOT NULL,
      place_id INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS places_staging_pcode_idx ON places_staging(pcode_normalized);
    CREATE INDEX IF NOT EXISTS place_grid_staging_cell_idx ON place_grid_staging(cell_key);
  `);

  // Step 2: Clear staging tables
  await database.execAsync('DELETE FROM place_grid_staging');
  await database.execAsync('DELETE FROM places_staging');

  // Step 3: Insert new data into staging tables in batches
  await database.withTransactionAsync(async () => {
    // Insert places in batches to avoid memory pressure
    for (let i = 0; i < dataset.places.length; i += TRANSACTION_BATCH_SIZE) {
      const batch = dataset.places.slice(i, i + TRANSACTION_BATCH_SIZE);

      for (const place of batch) {
        const inserted = await database.runAsync(
          `INSERT INTO places_staging ${PLACE_COLUMNS} VALUES (${Array.from({ length: 23 }, () => '?').join(', ')})`,
          placeValues(place),
        );

        if (place.lat !== null && place.lng !== null) {
          await database.runAsync(
            'INSERT INTO place_grid_staging (cell_key, place_id) VALUES (?, ?)',
            getGridCellKey({ latitude: place.lat, longitude: place.lng }),
            Number(inserted.lastInsertRowId),
          );
        }
      }
    }

    // Step 4: Verify staging data integrity
    const stagingCount = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM places_staging'
    );
    if (stagingCount?.count !== dataset.places.length) {
      throw new Error('Staging data integrity check failed: count mismatch');
    }
  });

  // Step 5: Atomic swap - replace production tables with staging tables
  await database.withExclusiveTransactionAsync(async (transaction) => {
    // Drop old tables
    await transaction.runAsync('DROP TABLE IF EXISTS place_grid');
    await transaction.runAsync('DROP TABLE IF EXISTS places');

    // Rename staging tables to production tables
    await transaction.runAsync('ALTER TABLE place_grid_staging RENAME TO place_grid');
    await transaction.runAsync('ALTER TABLE places_staging RENAME TO places');

    // Recreate indexes on the new tables
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_pcode_idx ON places(pcode_normalized)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_postal_code_idx ON places(postal_code_normalized)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_type_idx ON places(type)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_sr_pcode_idx ON places(sr_pcode)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_district_pcode_idx ON places(district_pcode)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_tsp_pcode_idx ON places(tsp_pcode)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_town_pcode_idx ON places(town_pcode)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_vt_pcode_idx ON places(vt_pcode)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_name_eng_idx ON places(name_eng_normalized)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_name_mmr_idx ON places(name_mmr_normalized)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS places_tsp_name_idx ON places(tsp_name_normalized)');
    await transaction.runAsync('CREATE INDEX IF NOT EXISTS place_grid_cell_idx ON place_grid(cell_key)');

    // Rebuild FTS tables
    await transaction.runAsync('DROP TABLE IF EXISTS places_name_fts');
    await transaction.runAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS places_name_fts USING fts5(
        name_eng_normalized,
        name_mmr_normalized,
        tsp_name_normalized,
        postal_code_normalized,
        content = 'places',
        content_rowid = 'id',
        tokenize = 'trigram'
      )
    `);

    // Populate FTS table from new data
    await transaction.runAsync(`
      INSERT INTO places_name_fts (rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized)
      SELECT id, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized FROM places
    `);

    // Update metadata
    await transaction.runAsync('DELETE FROM dataset_metadata');

    const metadataValues = {
      ...dataset.metadata,
      installedAt,
      updatedAt: installedAt,
      datasetOrigin: 'update',
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    };
    for (const [key, value] of Object.entries(metadataValues)) {
      await transaction.runAsync(
        'INSERT INTO dataset_metadata (key, value) VALUES (?, ?)',
        key,
        String(value),
      );
    }
  });

  // Step 6: Post-commit verification
  const finalCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM places'
  );
  if (finalCount?.count !== dataset.places.length) {
    throw new Error('Post-commit verification failed: count mismatch');
  }

  // Step 7: Verify integrity
  const integrity = await database.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check'
  );
  if (integrity?.integrity_check !== 'ok') {
    throw new Error('SQLite integrity check failed after dataset installation');
  }
}

export async function validateDatasetJson(jsonText: string): Promise<CompactDataset> {
  if (jsonText.length > MAX_DATASET_JSON_SIZE) {
    throw new AppError(
      'DATASET_INVALID',
      `Dataset file is too large. Maximum size is ${(MAX_DATASET_JSON_SIZE / 1024 / 1024).toFixed(0)}MB.`,
    );
  }

  let dataset: unknown;
  try {
    dataset = JSON.parse(jsonText);
  } catch (error) {
    throw new AppError('DATASET_INVALID', 'Dataset file is not valid JSON.', { cause: error });
  }

  const validationError = validateCompactDataset(dataset);
  if (validationError) throw new AppError('DATASET_INVALID', validationError);

  const compactDataset = dataset as CompactDataset;
  const checksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(compactDataset.places),
  );
  if (checksum.toLowerCase() !== compactDataset.metadata.checksum.toLowerCase()) {
    throw new AppError('DATASET_INVALID', 'Dataset checksum does not match its places array.');
  }

  return compactDataset;
}

export async function installValidatedDataset(
  database: SQLiteDatabase,
  dataset: CompactDataset,
): Promise<void> {
  try {
    await persistDataset(database, dataset);
  } catch (error) {
    // Don't wrap verification errors - they should surface as-is
    if (error instanceof Error && (
      error.message.includes('integrity check failed') ||
      error.message.includes('verification failed') ||
      error.message.includes('count mismatch')
    )) {
      throw error;
    }
    throw new AppError('DATASET_UPDATE_FAILED', 'Dataset could not be installed; the previous database was retained.', {
      cause: error,
    });
  }
}

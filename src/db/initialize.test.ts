import type { SQLiteDatabase } from 'expo-sqlite';

import type { DatasetStatus } from '@/types/pcode';
import { initializeDatabase } from './initialize';
import { getDatasetStatus } from './metadata';
import { DATABASE_SCHEMA_VERSION } from './schema';

jest.mock('./metadata');

const mockDatabase = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
} as unknown as SQLiteDatabase;

const readyStatus: DatasetStatus = {
  state: 'ready',
  metadata: {
    datasetVersion: '9.7',
    generatedAt: '2026-10-09T00:00:00.000Z',
    source: 'MIMU',
    recordCount: 1,
    schemaVersion: 1,
    checksum: 'a'.repeat(64),
  },
  installedAt: '2026-10-09T00:00:00.000Z',
  origin: 'installed',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

describe('initializeDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects initialization when the database is not ready', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue({
      state: 'invalid',
      message: 'Missing places table',
    });

    await expect(initializeDatabase(mockDatabase)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
  });

  it('rejects initialization when the database is missing', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue({
      state: 'missing',
    });

    await expect(initializeDatabase(mockDatabase)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
  });

  it('rejects initialization when the schema version is unsupported', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue(readyStatus);
    jest.mocked(mockDatabase.getFirstAsync).mockResolvedValue({ user_version: 1 });

    await expect(initializeDatabase(mockDatabase)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
  });

  it('rejects initialization when SQLite integrity check fails', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue(readyStatus);
    jest.mocked(mockDatabase.getFirstAsync)
      .mockResolvedValueOnce({ user_version: DATABASE_SCHEMA_VERSION })
      .mockResolvedValueOnce({ integrity_check: 'corrupt' });

    await expect(initializeDatabase(mockDatabase)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
  });

  it('rejects initialization when required indexes are missing', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue(readyStatus);
    jest.mocked(mockDatabase.getFirstAsync)
      .mockResolvedValueOnce({ user_version: DATABASE_SCHEMA_VERSION })
      .mockResolvedValueOnce({ integrity_check: 'ok' });
    jest.mocked(mockDatabase.getAllAsync).mockResolvedValue([
      { name: 'places_pcode_idx' },
      { name: 'places_postal_code_idx' },
    ]);

    await expect(initializeDatabase(mockDatabase)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
  });

  it('rejects initialization when FTS search objects are missing', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue(readyStatus);
    jest.mocked(mockDatabase.getFirstAsync)
      .mockResolvedValueOnce({ user_version: DATABASE_SCHEMA_VERSION })
      .mockResolvedValueOnce({ integrity_check: 'ok' });
    jest.mocked(mockDatabase.getAllAsync)
      .mockResolvedValueOnce([
        { name: 'places_pcode_idx' },
        { name: 'places_postal_code_idx' },
        { name: 'places_type_idx' },
        { name: 'places_tsp_pcode_idx' },
        { name: 'places_town_pcode_idx' },
        { name: 'places_vt_pcode_idx' },
        { name: 'place_grid_cell_idx' },
      ])
      .mockResolvedValueOnce([{ name: 'places_name_fts' }]);

    await expect(initializeDatabase(mockDatabase)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
  });

  it('succeeds when all validation checks pass and sets metadata', async () => {
    jest.mocked(getDatasetStatus).mockResolvedValue(readyStatus);
    jest.mocked(mockDatabase.getFirstAsync)
      .mockResolvedValueOnce({ user_version: DATABASE_SCHEMA_VERSION })
      .mockResolvedValueOnce({ integrity_check: 'ok' });
    jest.mocked(mockDatabase.getAllAsync)
      .mockResolvedValueOnce([
        { name: 'places_pcode_idx' },
        { name: 'places_postal_code_idx' },
        { name: 'places_type_idx' },
        { name: 'places_tsp_pcode_idx' },
        { name: 'places_town_pcode_idx' },
        { name: 'places_vt_pcode_idx' },
        { name: 'place_grid_cell_idx' },
      ])
      .mockResolvedValueOnce([
        { name: 'places_name_fts' },
        { name: 'places_name_fts_insert' },
        { name: 'places_name_fts_update' },
        { name: 'places_name_fts_delete' },
      ]);

    await expect(initializeDatabase(mockDatabase)).resolves.not.toThrow();

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dataset_metadata (key, value)'),
      expect.any(String),
    );

    const originInsert = (mockDatabase.runAsync as jest.Mock).mock.calls.find(
      (call: unknown[]) => call[0] === "INSERT OR IGNORE INTO dataset_metadata (key, value) VALUES ('datasetOrigin', 'installed')",
    );
    expect(originInsert).toBeDefined();
  });
});

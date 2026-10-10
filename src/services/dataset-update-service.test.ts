import type { SQLiteDatabase } from 'expo-sqlite';

import { installValidatedDataset, validateDatasetJson } from '@/db/dataset-installer';
import type { CompactDataset } from '@/db/dataset-validation';
import { getDatasetStatus } from '@/db/metadata';
import { AppError } from '@/types/errors';
import type { DatasetStatus } from '@/types/pcode';
import { updateDatasetFromUrl } from './dataset-update-service';

jest.mock('@/db/dataset-installer');
jest.mock('@/db/metadata');

// Mock global fetch
const mockFetch = jest.fn() as jest.Mock;
(globalThis as any).fetch = mockFetch;

const mockDatabase = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
  withExclusiveTransactionAsync: jest.fn(),
} as unknown as SQLiteDatabase;

const validDatasetMetadata = {
  datasetVersion: '9.8',
  generatedAt: '2026-10-09T00:00:00.000Z',
  source: 'MIMU + Myanmar Postal Code + OCHA',
  recordCount: 1,
  schemaVersion: 1,
  checksum: 'a'.repeat(64),
};

const validDataset: CompactDataset = {
  metadata: validDatasetMetadata,
  places: [
    {
      type: 'village',
      pcode: 'MMR001001001',
      name_eng: 'Yangon',
      name_mmr: 'ရန်ကုန်',
      sr_pcode: null,
      sr_name: null,
      district_pcode: null,
      district_name: null,
      tsp_pcode: null,
      tsp_name: null,
      town_pcode: null,
      town_name: null,
      vt_pcode: null,
      vt_name: null,
      lat: 16.8,
      lng: 96.1,
      coord_source: 'mimu',
      postal_code: null,
    },
  ],
};

const readyStatus: DatasetStatus = {
  state: 'ready',
  metadata: validDatasetMetadata,
  installedAt: '2026-10-09T00:00:00.000Z',
  origin: 'installed',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

describe('updateDatasetFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an empty URL', async () => {
    await expect(updateDatasetFromUrl(mockDatabase, ' ')).rejects.toMatchObject({
      code: 'DATASET_UPDATE_FAILED',
    });
  });

  it('rejects a failed HTTP request', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: jest.fn() },
      text: () => Promise.resolve('Not Found'),
    } as Response);

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toMatchObject({
      code: 'DATASET_UPDATE_FAILED',
    });
  });

  it('rejects a network error during download', async () => {
    (globalThis as any).fetch.mockRejectedValue(new Error('Network error'));

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toMatchObject({
      code: 'DATASET_UPDATE_FAILED',
    });
  });

  it('rejects a dataset that exceeds the maximum download size', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue((101 * 1024 * 1024).toString()) },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toMatchObject({
      code: 'DATASET_UPDATE_FAILED',
    });
    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toThrow('too large');
  });

  it('returns "current" when the downloaded version matches the installed version', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    jest.mocked(validateDatasetJson).mockResolvedValue(validDataset);
    jest.mocked(getDatasetStatus).mockResolvedValue({
      ...readyStatus,
      metadata: { ...validDatasetMetadata, datasetVersion: '9.8' },
    });

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).resolves.toBe('current');
  });

  it('rejects a downloaded dataset older than the installed version', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    jest.mocked(validateDatasetJson).mockResolvedValue(validDataset);
    jest.mocked(getDatasetStatus).mockResolvedValue({
      ...readyStatus,
      metadata: { ...validDatasetMetadata, datasetVersion: '9.9' },
    });

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toMatchObject({
      code: 'DATASET_UPDATE_FAILED',
    });
  });

  it('installs a newer dataset version', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    jest.mocked(validateDatasetJson).mockResolvedValue(validDataset);
    jest.mocked(getDatasetStatus).mockResolvedValue({
      ...readyStatus,
      metadata: { ...validDatasetMetadata, datasetVersion: '9.7' },
    });
    jest.mocked(installValidatedDataset).mockResolvedValue(undefined);

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).resolves.toBe('updated');
    expect(installValidatedDataset).toHaveBeenCalledWith(mockDatabase, validDataset);
  });

  it('installs a dataset when the current database is not ready', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    jest.mocked(validateDatasetJson).mockResolvedValue(validDataset);
    jest.mocked(getDatasetStatus).mockResolvedValue({
      state: 'invalid',
      message: 'Database corrupted',
    });
    jest.mocked(installValidatedDataset).mockResolvedValue(undefined);

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).resolves.toBe('updated');
    expect(installValidatedDataset).toHaveBeenCalledWith(mockDatabase, validDataset);
  });

  it('preserves the existing database when installation fails', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    jest.mocked(validateDatasetJson).mockResolvedValue(validDataset);
    jest.mocked(getDatasetStatus).mockResolvedValue({
      ...readyStatus,
      metadata: { ...validDatasetMetadata, datasetVersion: '9.7' },
    });
    jest.mocked(installValidatedDataset).mockRejectedValue(new AppError('DATASET_UPDATE_FAILED', 'Installation failed'));

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toMatchObject({
      code: 'DATASET_UPDATE_FAILED',
    });
  });

  it('rejects an invalid dataset version format', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve(JSON.stringify(validDataset)),
    } as Response);

    jest.mocked(validateDatasetJson).mockResolvedValue(validDataset);
    jest.mocked(getDatasetStatus).mockResolvedValue({
      ...readyStatus,
      metadata: { ...validDatasetMetadata, datasetVersion: 'latest' },
    });

    await expect(updateDatasetFromUrl(mockDatabase, 'https://example.com/dataset.json')).rejects.toMatchObject({
      code: 'DATASET_INVALID',
    });
  });
});

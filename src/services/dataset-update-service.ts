import type { SQLiteDatabase } from 'expo-sqlite';

import { installValidatedDataset, validateDatasetJson } from '@/db/dataset-installer';
import { getDatasetStatus } from '@/db/metadata';
import { AppError } from '@/types/errors';
import { compareDatasetVersions } from '@/utils/dataset-version';

const MAX_DATASET_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const DATASET_DOWNLOAD_TIMEOUT_MS = 60_000; // 60 seconds

export async function updateDatasetFromUrl(
  database: SQLiteDatabase,
  url: string,
  signal?: AbortSignal,
): Promise<'current' | 'updated'> {
  if (!url.trim()) {
    throw new AppError('DATASET_UPDATE_FAILED', 'No dataset update URL is configured.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DATASET_DOWNLOAD_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('DATASET_UPDATE_FAILED', 'Dataset download timed out after 60 seconds.');
    }
    throw new AppError('DATASET_UPDATE_FAILED', 'Dataset update could not be downloaded.', {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new AppError('DATASET_UPDATE_FAILED', `Dataset update failed with HTTP ${response.status}.`);
  }

  const contentLength = response.headers.get('Content-Length');
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (Number.isFinite(size) && size > MAX_DATASET_DOWNLOAD_SIZE) {
      throw new AppError(
        'DATASET_UPDATE_FAILED',
        `Dataset file is too large. Maximum size is ${(MAX_DATASET_DOWNLOAD_SIZE / 1024 / 1024).toFixed(0)}MB.`,
      );
    }
  }

  const jsonText = await response.text();
  if (jsonText.length > MAX_DATASET_DOWNLOAD_SIZE) {
    throw new AppError(
      'DATASET_UPDATE_FAILED',
      `Dataset file is too large. Maximum size is ${(MAX_DATASET_DOWNLOAD_SIZE / 1024 / 1024).toFixed(0)}MB.`,
    );
  }

  const dataset = await validateDatasetJson(jsonText);
  const incomingVersion = dataset.metadata.datasetVersion;

  const current = await getDatasetStatus(database);
  if (current.state === 'ready') {
    let comparison: number;
    try {
      comparison = compareDatasetVersions(incomingVersion, current.metadata.datasetVersion);
    } catch (error) {
      throw new AppError('DATASET_INVALID', 'Dataset version format is invalid.', { cause: error });
    }
    if (comparison === 0) return 'current';
    if (comparison < 0) {
      throw new AppError('DATASET_UPDATE_FAILED', 'The downloaded dataset is older than the installed dataset.');
    }
  }

  await installValidatedDataset(database, dataset);
  return 'updated';
}
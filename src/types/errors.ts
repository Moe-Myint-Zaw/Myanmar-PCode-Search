export type AppErrorCode =
  | 'DATABASE_NOT_READY'
  | 'DATABASE_CORRUPTED'
  | 'DATASET_INVALID'
  | 'DATASET_UPDATE_FAILED'
  | 'GEOCODING_UNAVAILABLE'
  | 'GEOCODING_RATE_LIMITED'
  | 'INVALID_COORDINATES'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'GPS_TIMEOUT'
  | 'MAP_NATIVE_MODULE_MISSING'
  | 'OFFLINE_PACK_DOWNLOAD_FAILED'
  | 'OFFLINE_PACK_NOT_FOUND'
  | 'MAP_STYLE_NOT_CONFIGURED';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}
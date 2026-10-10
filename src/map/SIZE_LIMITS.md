# Download Size Limits

This file documents the size limits enforced for all network downloads and JSON parsing operations.

## Geocoding Service Download

**Location:** `src/services/geocoding-service.ts`

**Limits:**
- `MAX_GEOCODING_RESPONSE_SIZE = 10_240` bytes (10KB)
- `GEOCODING_TIMEOUT_MS = 10_000` ms (10 seconds)

**Purpose:** Prevents DoS attacks through oversized geocoding responses and indefinite hangs.

**Implementation:**
- Content-Length header validation before response parsing
- Response body size validation after download
- AbortController with timeout (10 seconds)
- Custom User-Agent header for Nominatim API compliance
- Combined with JSON size validation

**Example:**
```typescript
const contentLength = response.headers.get('Content-Length');
if (contentLength) {
  const size = Number.parseInt(contentLength, 10);
  if (Number.isFinite(size) && size > MAX_GEOCODING_RESPONSE_SIZE) {
    throw new AppError('GEOCODING_UNAVAILABLE', 'Response too large.');
  }
}

const responseText = await response.text();
if (responseText.length > MAX_GEOCODING_RESPONSE_SIZE) {
  throw new AppError('GEOCODING_UNAVAILABLE', 'Response too large.');
}
```

## localStorage Timestamps

**Location:** `src/map/offline-map-service.ts`

**Limit:** `MAX_LOCALSTORAGE_JSON_SIZE = 10_240` bytes (10KB)

**Purpose:** Prevents memory exhaustion and DoS attacks through oversized localStorage values.

**Implementation:**
- Size check in `getPackUpdateTimestamps()` before `JSON.parse()`
- Corrupted data is automatically cleared
- Fallback to empty object on any error

**Example:**
```typescript
const rawValue = localStorage.getItem(PACK_UPDATE_TIMESTAMPS_KEY);
if (rawValue && rawValue.length > MAX_LOCALSTORAGE_JSON_SIZE) {
  localStorage.removeItem(PACK_UPDATE_TIMESTAMPS_KEY);
  return {};
}
```

## Dataset JSON

**Location:** `src/db/dataset-installer.ts`

**Limit:** `MAX_DATASET_JSON_SIZE = 100 * 1024 * 1024` bytes (100MB)

**Purpose:** Prevents memory exhaustion during dataset updates from malicious or corrupted sources.

**Implementation:**
- Size check in `validateDatasetJson()` before `JSON.parse()`
- Clear error message if exceeded
- Combined with Content-Length validation in download service

**Example:**
```typescript
if (jsonText.length > MAX_DATASET_JSON_SIZE) {
  throw new AppError(
    'DATASET_INVALID',
    `Dataset file is too large. Maximum size is ${(MAX_DATASET_JSON_SIZE / 1024 / 1024).toFixed(0)}MB.`,
  );
}
```

## Dataset Stream Parsing

**Location:** `src/db/dataset-stream.ts`

**Limits:**
- `MAX_TOKEN_SIZE = 1_048_576` bytes (1MB per token)
- `MAX_DATASET_STREAM_SIZE = 100 * 1024 * 1024` bytes (100MB total)
- `MAX_NESTING_DEPTH = 100` levels

**Purpose:** Prevents memory exhaustion through deeply nested structures or oversized individual tokens during streaming JSON parsing.

**Implementation:**
- Token size check before `JSON.parse()` for string and value tokens
- Total bytes read check in `readMore()`
- Nesting depth tracking for objects and arrays
- All checks throw `AppError` with descriptive messages

**Example:**
```typescript
if (jsonString.length > MAX_TOKEN_SIZE) {
  throw new AppError('DATASET_INVALID', 'JSON token size exceeds maximum limit.');
}

if (this.totalBytesRead > MAX_DATASET_STREAM_SIZE) {
  throw new AppError(
    'DATASET_INVALID',
    `Dataset file is too large. Maximum size is ${(MAX_DATASET_STREAM_SIZE / 1024 / 1024).toFixed(0)}MB.`,
  );
}

if (this.nestingDepth > MAX_NESTING_DEPTH) {
  throw new AppError('DATASET_INVALID', 'JSON nesting depth exceeds maximum limit.');
}
```

## Dataset Download

**Location:** `src/services/dataset-update-service.ts`

**Limits:**
- `MAX_DATASET_DOWNLOAD_SIZE = 100 * 1024 * 1024` bytes (100MB)
- `DATASET_DOWNLOAD_TIMEOUT_MS = 60_000` ms (60 seconds)

**Purpose:** Prevents indefinite hangs and resource exhaustion during dataset downloads.

**Implementation:**
- Content-Length header validation before download
- Response body size validation after download
- AbortController with timeout
- Combined with JSON size validation

**Example:**
```typescript
const contentLength = response.headers.get('Content-Length');
if (contentLength) {
  const size = Number.parseInt(contentLength, 10);
  if (Number.isFinite(size) && size > MAX_DATASET_DOWNLOAD_SIZE) {
    throw new AppError('DATASET_UPDATE_FAILED', 'Dataset file is too large.');
  }
}

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), DATASET_DOWNLOAD_TIMEOUT_MS);
```

## Rationale for Limits

These limits are chosen based on:

1. **Memory constraints:** Mobile devices have limited RAM (typically 2-8GB)
2. **Use case analysis:**
   - Myanmar PCode dataset is ~10-50MB in practice
   - Geocoding responses are typically <1KB for single result
   - Map pack timestamps are small metadata (KB range)
3. **Security:** Prevents DoS attacks through oversized payloads
4. **User experience:** Fast validation before resource-intensive operations
5. **Defense in depth:** Multiple layers of validation (download, stream, parse)
6. **API compliance:** User-Agent header for Nominatim usage policy compliance

## Testing

Size limits are tested in:
- `src/db/dataset-installer.test.ts` - Dataset JSON size validation
- `src/db/dataset-stream.test.ts` - Streaming parser limits
- `src/services/dataset-update-service.test.ts` - Download size and timeout
- `src/services/geocoding-service.test.ts` - Geocoding response size and timeout

Large-scale tests (100MB+) are documented but not included in unit tests to avoid test suite bloat.

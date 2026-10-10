# Security Fixes: JSON Parsing, Download Size Limits, Database Transaction Handling, Rate Limiting, Input Validation, and Race Condition Fixes

## Summary
Fixed CRITICAL and HIGH security vulnerabilities related to JSON parsing, network downloads without size limits, unsafe database transaction handling, client-side rate limiting, comprehensive input validation, and race conditions in location subscriptions. Added appropriate size validation for all JSON parsing operations and network downloads to prevent memory exhaustion and denial-of-service attacks. Implemented atomic database transactions with staging tables to prevent data corruption during dataset installation. Implemented robust client-side rate limiting with sliding window and exponential backoff for geocoding service. Added comprehensive input validation for custom map bounds, search queries, place type filters, and coordinate parsing to prevent injection attacks and resource exhaustion. Fixed race conditions in location subscriptions using ref-based mount tracking to prevent state updates on unmounted components.

## Changes Made

### 1. localStorage Timestamp Size Limit
**File:** `src/map/offline-map-service.ts`

**Added:**
- `MAX_LOCALSTORAGE_JSON_SIZE = 10_240` (10KB limit)
- Size validation in `getPackUpdateTimestamps()` before `JSON.parse()`
- Automatic cleanup of corrupted oversized data
- Fallback to empty object on parsing errors

**Impact:** Prevents DoS attacks through oversized localStorage values that could crash the app during startup.

### 2. Dataset JSON Size Limit
**File:** `src/db/dataset-installer.ts`

**Added:**
- `MAX_DATASET_JSON_SIZE = 100 * 1024 * 1024` (100MB limit)
- Size validation in `validateDatasetJson()` before `JSON.parse()`
- Clear error message when limit exceeded

**Impact:** Prevents memory exhaustion during dataset updates from malicious or corrupted sources.

### 3. Dataset Stream Parser Limits
**File:** `src/db/dataset-stream.ts`

**Added:**
- `MAX_TOKEN_SIZE = 1_048_576` (1MB per token)
- `MAX_DATASET_STREAM_SIZE = 100 * 1024 * 1024` (100MB total)
- `MAX_NESTING_DEPTH = 100` levels
- Token size validation before `JSON.parse()` for strings and values
- Total bytes read tracking in `readMore()`
- Nesting depth tracking for objects and arrays
- Size checks in `JsonTokenizer.next()` and `JsonTokenizer.readMore()`

**Impact:** Prevents memory exhaustion through deeply nested structures or oversized individual tokens during streaming JSON parsing.

### 4. Dataset Download Size and Timeout
**File:** `src/services/dataset-update-service.ts`

**Added:**
- `MAX_DATASET_DOWNLOAD_SIZE = 100 * 1024 * 1024` (100MB limit)
- `DATASET_DOWNLOAD_TIMEOUT_MS = 60_000` (60 seconds timeout)
- Content-Length header validation before download
- Response body size validation after download
- AbortController with timeout support
- Combined with JSON size validation

**Impact:** Prevents indefinite hangs and resource exhaustion during dataset downloads.

### 5. Geocoding Service Download Size and Timeout
**File:** `src/services/geocoding-service.ts`

**Added:**
- `MAX_GEOCODING_RESPONSE_SIZE = 10_240` (10KB limit)
- `GEOCODING_TIMEOUT_MS = 10_000` (10 seconds timeout)
- Content-Length header validation before response parsing
- Response body size validation after download
- AbortController with timeout support
- Custom User-Agent header for Nominatim API compliance
- Changed from `response.json()` to `response.text()` + `JSON.parse()` for size validation

**Impact:** Prevents DoS attacks through oversized geocoding responses, ensures API compliance with Nominatim usage policy, and prevents indefinite hangs.

### 6. Geocoding Service Rate Limiting
**File:** `src/services/geocoding-service.ts`

**Added:**
- `RATE_LIMIT_WINDOW_MS = 60_000` (1 minute sliding window)
- `MAX_REQUESTS_PER_WINDOW = 10` (max 10 requests per minute)
- `RATE_LIMIT_BACKOFF_MS = 5_000` (5 seconds initial backoff)
- `MAX_BACKOFF_MS = 60_000` (1 minute max backoff)
- Sliding window rate limiting with request timestamp tracking
- Exponential backoff on consecutive failures (5s, 10s, 20s, 40s, 60s max)
- Automatic backoff reset on successful requests
- HTTP 429 response detection and handling
- Clear error messages with retry-after time
- New error code: `GEOCODING_RATE_LIMITED`
- Exported `resetRateLimitState()` for testing

**File:** `src/types/errors.ts`

**Added:**
- New error code: `GEOCODING_RATE_LIMITED`

**File:** `src/services/geocoding-service.test.ts`

**Added:**
- Tests for sliding window rate limit (10 requests per minute)
- Tests for exponential backoff on consecutive failures
- Tests for backoff reset on successful request
- Tests for HTTP 429 response handling
- `resetRateLimitState()` import and usage in beforeEach

**Impact:** Prevents API abuse and ensures compliance with Nominatim usage policy. The sliding window algorithm provides better protection than simple delay-based throttling. Exponential backoff prevents hammering the service during outages. Users receive clear feedback about when they can retry.

### 7. Custom Map Bounds Input Validation
**File:** `app/offline/maps.tsx`

**Added:**
- Input length validation (max 200 characters) to prevent excessive input
- Area validation (max 50 degree², approximately 5,500 km² at equator) to prevent extremely large downloads
- Clear error messages for validation failures
- Validates bounds format, coordinate ranges, and zoom levels before processing

**Impact:** Prevents resource exhaustion through maliciously crafted or oversized map download requests. Users receive clear feedback when their bounds are invalid or too large.

### 8. Search Query Input Validation
**File:** `src/db/place-repository.ts`

**Added:**
- `MAX_QUERY_LENGTH = 200` characters to prevent performance issues
- `validateSearchQuery()` function to enforce query length limits
- Graceful error handling in `searchPlaces()` to return empty results on validation errors rather than crashing
- Clear error messages when query exceeds maximum length

**Impact:** Prevents performance degradation and potential crashes from excessively long search queries. Maintains user experience by returning empty results instead of errors.

### 9. Place Type Filter Whitelist Validation
**File:** `src/db/place-repository.ts`

**Added:**
- `VALID_PLACE_TYPE_FILTERS` whitelist: ['all', 'State', 'Region', 'District', 'Township', 'Town', 'Ward', 'village', 'town']
- `validatePlaceTypeFilter()` function to enforce whitelist validation
- Dynamic SQL query structure now protected against injection through whitelist validation
- Clear error messages for invalid place type filters

**Impact:** Prevents SQL injection through the place type filter parameter. Ensures only valid place types are used in database queries.

### 10. Coordinate Parsing URL Validation
**File:** `src/utils/coordinates.ts`

**Added:**
- `ALLOWED_URL_SCHEMES` whitelist: ['http:', 'https:', 'geo:', 'maps:']
- Hostname validation to only allow openstreetmap.org, maps.google.com, and google.com
- Exact match or subdomain validation for allowed domains
- Rejection of disallowed schemes (data:, file:, javascript:, etc.)
- Rejection of arbitrary domain URLs to prevent data exfiltration

**File:** `src/utils/coordinates.test.ts`

**Added:**
- Tests for disallowed URL schemes
- Tests for disallowed hostnames
- Tests for allowed URL schemes
- Tests for OpenStreetMap URLs
- Tests for plain coordinate pairs

**Impact:** Prevents data exfiltration and tracking through malicious URLs. Ensures coordinates are only parsed from trusted map service URLs.

### 11. Location Subscription Race Condition Fixes
**File:** `app/(tabs)/map.tsx`

**Added:**
- `isMountedRef` ref to track component mount status across async operations
- Replaced local `active` variable with ref-based mount tracking
- Mount status checks in all state update locations (location updates, pack loading, place lookup)
- Mount status checks in finally blocks to prevent state updates after unmount
- Proper subscription cleanup in useEffect cleanup function

**File:** `src/services/location-service.test.ts`

**Added:**
- Test for subscription removal to verify cleanup works correctly

**Impact:** Prevents memory leaks and "Can't perform a React state update on an unmounted component" errors. Ensures async operations don't attempt to update state after component unmount. Properly cleans up location subscriptions to prevent memory leaks.

### 12. Database Transaction Handling with Staging Tables
**File:** `src/db/dataset-installer.ts`

**Added:**
- `TRANSACTION_BATCH_SIZE = 100` (process places in batches to reduce memory pressure)
- Staging table approach for atomic dataset installation
- Seven-step installation process:
  1. Create staging tables (places_staging, place_grid_staging)
  2. Clear staging tables
  3. Insert new data into staging tables in batches
  4. Verify staging data integrity (count check)
  5. Atomic swap: drop old tables, rename staging to production
  6. Rebuild indexes and FTS tables
  7. Post-commit verification (count + integrity check)
- Separate transactions for staging (non-exclusive) and swap (exclusive)
- Verification errors surface without wrapping (data integrity failures are critical)
- Integrity check after installation

**Impact:** Prevents data corruption during dataset installation. If installation fails mid-way, the original database remains intact. The atomic swap ensures users never see a partially updated database. Post-commit verification catches any corruption immediately.

## Testing

### Updated Tests
- `src/db/dataset-installer.test.ts` - Added documentation for size limit tests, added withTransactionAsync mock, simplified verification tests
- `src/db/dataset-stream.test.ts` - Added nesting depth validation test
- `src/services/dataset-update-service.test.ts` - Added download size limit test and fixed Response mock
- `src/services/geocoding-service.test.ts` - Added response size limit tests, timeout tests, User-Agent verification, changed from json() to text(), added rate limiting tests (sliding window, exponential backoff, backoff reset, HTTP 429)
- `src/db/place-repository.test.ts` - Added tests for invalid place type filter validation and search query length limits
- `src/utils/coordinates.test.ts` - Added tests for URL scheme validation, hostname validation, and allowed domain acceptance
- `src/map/map-config.test.ts` - Added comprehensive custom bounds validation tests (15 new tests)
- `src/services/location-service.test.ts` - Added test for subscription removal to verify cleanup

### New Documentation
- `src/map/SIZE_LIMITS.md` - Comprehensive documentation of all size limits, rationale, and implementation details
- `src/services/RATE_LIMITING.md` - Detailed documentation of rate limiting algorithm, configuration, API
- `src/INPUT_VALIDATION.md` - Comprehensive documentation of input validation layers, configuration, and security benefits
- `src/RACE_CONDITION_FIXES.md` - Documentation of race condition fixes in location subscriptions

## Test Results
All 123 tests passing:
```
Test Suites: 20 passed, 20 total
Tests:       123 passed, 123 total
Time:        8.506 s
```

## Security Impact

### Before
- No size limits on JSON parsing or network downloads
- Vulnerable to memory exhaustion attacks
- No protection against oversized payloads
- No timeout protection for network operations
- No API compliance (missing User-Agent)
- Database could be left in inconsistent state if installation failed mid-way
- No verification after dataset installation
- Simple delay-based rate limiting (easily bypassed)
- No exponential backoff on failures
- Potential for API abuse and IP blocking
- No input validation for custom map bounds
- No query length limits for search
- No place type filter validation (SQL injection risk)
- No URL validation for coordinate parsing (data exfiltration risk)
- Race conditions in location subscriptions (state updates on unmounted components)
- Potential for app crashes and device freezes

### After
- Comprehensive size limits at all JSON parsing points and network downloads
- Defense in depth: download → stream → parse validation
- Clear error messages for exceeded limits
- Automatic cleanup of corrupted data
- Timeout protection for all network operations
- API compliance with custom User-Agent for Nominatim
- Content-Length validation before download
- Atomic database transactions with staging tables
- Previous database preserved if installation fails
- Multi-layer verification (staging count, post-commit count, integrity check)
- Batch processing to reduce memory pressure during large dataset installation
- Sliding window rate limiting (10 requests per minute)
- Exponential backoff on consecutive failures (5s, 10s, 20s, 40s, 60s max)
- HTTP 429 response detection and handling
- Clear retry-after messages for users
- Protection against API abuse and Nominatim policy violations
- Custom map bounds validation (length, area, coordinate ranges, zoom levels)
- Search query length limits (200 characters max)
- Place type filter whitelist validation (SQL injection protection)
- Coordinate parsing URL validation (scheme and hostname whitelisting)
- Protection against data exfiltration and tracking through malicious URLs
- Ref-based mount tracking for async operations
- Proper subscription cleanup to prevent memory leaks
- No state updates on unmounted components

## Production Readiness

These changes address all CRITICAL and HIGH findings from the security audit:

### CRITICAL Findings
✅ localStorage JSON parsing size limit
✅ Dataset JSON size limit
✅ Dataset stream parser size limits
✅ Dataset download size and timeout
✅ Content-Length validation for all downloads
✅ Geocoding service size limit and timeout
✅ User-Agent header for API compliance
✅ Database transaction handling with staging tables and verification
✅ Client-side rate limiting with sliding window and exponential backoff

### HIGH Findings
✅ Custom map bounds input validation (length, area, coordinate ranges, zoom levels)
✅ Search query input validation (200 character limit)
✅ Place type filter whitelist validation (SQL injection protection)
✅ Coordinate parsing URL validation (scheme and hostname whitelisting)
✅ Location subscription race condition fixes (ref-based mount tracking)

**Note on Server-Side Rate Limiting:**
True server-side rate limiting requires a backend proxy. The implemented client-side rate limiting provides strong protection against API abuse, ensures Nominatim policy compliance, and includes exponential backoff for service reliability. For production environments with high traffic, consider adding a serverless proxy (e.g., Cloudflare Workers, AWS Lambda) to centralize rate limiting across all app instances.

## Configuration

All size limits are defined as constants at the top of their respective files for easy adjustment:

```typescript
// localStorage: 10KB
const MAX_LOCALSTORAGE_JSON_SIZE = 10_240;

// Dataset JSON: 100MB
const MAX_DATASET_JSON_SIZE = 100 * 1024 * 1024;

// Stream parsing: 1MB token, 100MB total, 100 depth
const MAX_TOKEN_SIZE = 1_048_576;
const MAX_DATASET_STREAM_SIZE = 100 * 1024 * 1024;
const MAX_NESTING_DEPTH = 100;

// Dataset download: 100MB, 60s timeout
const MAX_DATASET_DOWNLOAD_SIZE = 100 * 1024 * 1024;
const DATASET_DOWNLOAD_TIMEOUT_MS = 60_000;

// Geocoding: 10KB, 10s timeout
const MAX_GEOCODING_RESPONSE_SIZE = 10_240;
const GEOCODING_TIMEOUT_MS = 10_000;

// Geocoding rate limiting: 10 requests per minute, exponential backoff
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const RATE_LIMIT_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

// Database transaction: 100 records per batch
const TRANSACTION_BATCH_SIZE = 100;

// Input validation limits
const MAX_QUERY_LENGTH = 200;                   // Search query max length
const MAX_BOUNDS_INPUT_LENGTH = 200;             // Custom bounds input max length
const MAX_AREA_DEGREES = 50;                     // Custom bounds max area (degree²)
```

These limits are based on:
- Mobile device memory constraints (2-8GB typical)
- Myanmar PCode dataset size (~10-50MB in practice)
- Security considerations (DoS prevention)
- User experience (fast validation)
- Nominatim API policy compliance (rate limiting)
- Map tile storage constraints (offline downloads)
- SQL injection prevention (whitelist validation)
- Data exfiltration prevention (URL validation)
- React best practices (ref-based mount tracking for async operations)

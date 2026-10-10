# Input Validation

## Overview
Comprehensive input validation has been implemented across the application to prevent injection attacks, resource exhaustion, and data exfiltration. All user-facing inputs are validated before processing.

## Validation Layers

### 1. Custom Map Bounds Validation
**Location:** `app/offline/maps.tsx`

**Validations:**
- Input length: Maximum 200 characters
- Format: Must be exactly 4 comma-separated values (west, south, east, north)
- Coordinate ranges:
  - Longitude: -180 to 180
  - Latitude: -90 to 90
- Logical constraints:
  - west < east
  - south < north
- Zoom levels:
  - Must be integers
  - Range: 0 to 22
  - minZoom ≤ maxZoom
- Area constraint: Maximum 50 degree² (approximately 5,500 km² at equator)

**Error Messages:**
- "Bounds input is too long. Use the format: west, south, east, north"
- "Bounds must be west, south, east, north in valid longitude/latitude ranges; zooms must be whole numbers from 0 to 22."
- "The requested area is too large. Reduce the bounds to a smaller region."

### 2. Search Query Validation
**Location:** `src/db/place-repository.ts`

**Validations:**
- Query length: Maximum 200 characters
- Graceful degradation: Returns empty results on validation errors rather than crashing

**Configuration:**
```typescript
const MAX_QUERY_LENGTH = 200;
```

**Error Handling:**
- Validation errors are caught in `searchPlaces()` and return empty results
- Errors include "too long" message for user feedback

### 3. Place Type Filter Validation
**Location:** `src/db/place-repository.ts`

**Validations:**
- Whitelist-based validation to prevent SQL injection
- Allowed values: 'all', 'State', 'Region', 'District', 'Township', 'Town', 'Ward', 'village', 'town'

**Configuration:**
```typescript
const VALID_PLACE_TYPE_FILTERS: readonly PlaceTypeFilter[] = [
  'all', 'State', 'Region', 'District', 'Township', 'Town', 'Ward', 'village', 'town'
];
```

**Error Messages:**
- "Invalid place type filter: {type}. Must be one of: {list}"

**Security Impact:**
- Prevents SQL injection through the type parameter
- Ensures only valid place types are used in dynamic SQL queries

### 4. Coordinate Parsing URL Validation
**Location:** `src/utils/coordinates.ts`

**Validations:**
- URL scheme whitelist: http:, https:, geo:, maps:
- Hostname whitelist: openstreetmap.org, maps.google.com, google.com
- Subdomain support: Subdomains of allowed domains are accepted
- Coordinate range validation: Latitude -90 to 90, Longitude -180 to 180

**Configuration:**
```typescript
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'geo:', 'maps:']);
const ALLOWED_DOMAINS = ['openstreetmap.org', 'maps.google.com', 'google.com'];
```

**Security Impact:**
- Prevents data exfiltration through malicious URLs
- Prevents tracking through arbitrary domain access
- Blocks dangerous schemes (data:, file:, javascript:, etc.)

**Accepted Formats:**
- Plain coordinates: "16.8661, 96.1951"
- Google Maps URL: "https://maps.google.com/?q=16.8661,96.1951"
- Google Maps path: "https://maps.google.com/@16.8661,96.1951,12z"
- OpenStreetMap URL: "https://openstreetmap.org/?q=16.8661,96.1951"

**Rejected Formats:**
- Evil domains: "https://evil.com/?q=16.8661,96.1951"
- Dangerous schemes: "data:text/plain,16.8661,96.1951"
- File URLs: "file:///coordinates?16.8661,96.1951"
- JavaScript: "javascript:alert(1)"

## Testing

Comprehensive test coverage for all validation layers:

### Custom Bounds Tests
- Valid bounds and zoom levels
- Input length validation (200 character limit)
- Invalid number of bounds values
- Non-numeric bounds values
- Longitude/latitude out of range
- Logical constraints (west < east, south < north)
- Non-integer zoom levels
- Zoom levels out of range
- Min zoom > max zoom
- Area size validation
- Myanmar region bounds
- Whitespace handling

### Search Query Tests
- Query length validation (200 character limit)
- Invalid place type filter rejection
- Valid place type filter acceptance

### Coordinate Parsing Tests
- Disallowed URL schemes
- Disallowed hostnames
- Allowed URL schemes
- OpenStreetMap URLs
- Plain coordinate pairs
- Google Maps URLs

## Security Benefits

### Before
- No input validation for custom map bounds
- No query length limits
- No place type filter validation (SQL injection risk)
- No URL validation for coordinate parsing (data exfiltration risk)
- Potential for resource exhaustion through oversized inputs
- Potential for injection attacks

### After
- Comprehensive input validation at all user entry points
- Whitelist-based validation for structured inputs
- Length limits to prevent resource exhaustion
- Clear error messages for validation failures
- Protection against SQL injection
- Protection against data exfiltration
- Protection against tracking through malicious URLs
- Graceful degradation on validation errors

## Configuration Summary

All validation limits are defined as constants for easy adjustment:

```typescript
// Search query: 200 characters
const MAX_QUERY_LENGTH = 200;

// Custom bounds: 200 characters input, 50 degree² area
const MAX_BOUNDS_INPUT_LENGTH = 200;
const MAX_AREA_DEGREES = 50;

// Place type filters: whitelist of 9 values
const VALID_PLACE_TYPE_FILTERS = [
  'all', 'State', 'Region', 'District', 'Township', 'Town', 'Ward', 'village', 'town'
];

// Coordinate parsing: 4 URL schemes, 3 domains
const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'geo:', 'maps:'];
const ALLOWED_DOMAINS = ['openstreetmap.org', 'maps.google.com', 'google.com'];
```

## Recommendations

### Current Implementation
- ✅ Comprehensive input validation
- ✅ Whitelist-based validation for structured inputs
- ✅ Length limits to prevent resource exhaustion
- ✅ Clear error messages
- ✅ Graceful degradation

### Future Enhancements
- Consider adding client-side input sanitization before validation
- Consider adding input debouncing for text fields
- Consider adding input masking for coordinate fields
- Consider adding real-time validation feedback in UI
- Consider adding telemetry for validation failures (for abuse detection)

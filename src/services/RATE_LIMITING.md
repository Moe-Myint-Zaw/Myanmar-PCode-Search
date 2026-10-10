# Rate Limiting Implementation

## Overview
The geocoding service implements robust client-side rate limiting to prevent API abuse, ensure Nominatim policy compliance, and provide reliable service under failure conditions.

## Configuration

```typescript
const RATE_LIMIT_WINDOW_MS = 60_000;        // 1 minute sliding window
const MAX_REQUESTS_PER_WINDOW = 10;        // Max 10 requests per minute
const RATE_LIMIT_BACKOFF_MS = 5_000;        // 5 seconds initial backoff
const MAX_BACKOFF_MS = 60_000;              // 1 minute max backoff
```

## Rate Limiting Algorithm

### Sliding Window
- Tracks request timestamps in a rolling 1-minute window
- Automatically removes timestamps outside the current window
- Rejects requests when the window contains 10 or more requests
- Calculates and returns retry-after time in seconds

### Exponential Backoff
- Triggered on consecutive failures (network errors, timeouts, HTTP errors)
- Backoff duration: 5s, 10s, 20s, 40s, 60s (capped at 1 minute)
- Automatically resets on successful request
- Prevents hammering the service during outages

### HTTP 429 Handling
- Detects HTTP 429 (Too Many Requests) responses from Nominatim
- Treats 429 as a failure, triggering exponential backoff
- Returns user-friendly error with retry-after time

## Error Codes

### GEOCODING_RATE_LIMITED
Returned when:
- Sliding window limit exceeded (10 requests in 1 minute)
- Backoff period is active due to consecutive failures
- HTTP 429 received from Nominatim

Error message includes:
- Clear indication that rate limit was hit
- Time in seconds until retry is allowed

## State Management

Rate limit state is maintained in-memory:
```typescript
interface RateLimitState {
  requestTimestamps: number[];      // Timestamps of requests in current window
  consecutiveFailures: number;     // Count of consecutive failures
  backoffUntil: number;            // Timestamp when backoff expires
}
```

## Testing

Test coverage includes:
- Sliding window enforcement (10 requests per minute)
- Exponential backoff on consecutive failures
- Backoff reset on successful request
- HTTP 429 response handling
- State reset between tests via `resetRateLimitState()`

## Limitations

### Client-Side Only
- Rate limiting is enforced per app instance
- Multiple devices or app instances each have independent rate limits
- Does not protect against coordinated abuse across many devices

### For Production
Consider adding a serverless proxy for:
- Centralized rate limiting across all app instances
- Request aggregation and caching
- API key management
- Usage analytics and monitoring

## Nominatim Policy Compliance

The implementation follows Nominatim usage policy:
- Custom User-Agent header identifies the application
- Rate limiting prevents abuse
- Maximum 1 request per second on average (10 requests per minute)
- Exponential backoff prevents hammering during outages
- HTTP 429 detection respects server-side rate limits

## API

### `isRateLimited()`
Checks if the current request should be rate limited.
Returns: `{ limited: boolean, retryAfter?: number }`

### `recordRequest()`
Records a successful request timestamp in the sliding window.

### `recordFailure()`
Increments consecutive failure count and sets backoff duration.

### `recordSuccess()`
Resets consecutive failure count and backoff on successful request.

### `resetRateLimitState()` (exported for testing)
Resets all rate limit state to initial values.

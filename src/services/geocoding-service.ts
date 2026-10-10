import { AppError } from '@/types/errors';
import type { Coordinates } from '@/types/pcode';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export type LandmarkResult = Coordinates & { label: string };

// Rate limiting configuration
const MAX_GEOCODING_RESPONSE_SIZE = 10_240; // 10KB for geocoding response
const GEOCODING_TIMEOUT_MS = 10_000; // 10 seconds
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute
const RATE_LIMIT_BACKOFF_MS = 5_000; // 5 seconds initial backoff
const MAX_BACKOFF_MS = 60_000; // 1 minute max backoff

// Rate limit state
interface RateLimitState {
  requestTimestamps: number[];
  consecutiveFailures: number;
  backoffUntil: number;
}

let rateLimitState: RateLimitState = {
  requestTimestamps: [],
  consecutiveFailures: 0,
  backoffUntil: 0,
};

function isRateLimited(): { limited: boolean; retryAfter?: number } {
  const now = Date.now();

  // Check if we're in backoff period
  if (rateLimitState.backoffUntil > now) {
    return { limited: true, retryAfter: rateLimitState.backoffUntil - now };
  }

  // Remove timestamps outside the current window
  rateLimitState.requestTimestamps = rateLimitState.requestTimestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  // Check if we've exceeded the rate limit
  if (rateLimitState.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    // Calculate when the oldest request will expire
    const oldestTimestamp = rateLimitState.requestTimestamps[0]!;
    const retryAfter = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

function recordRequest(): void {
  const now = Date.now();
  rateLimitState.requestTimestamps.push(now);
}

function recordFailure(): void {
  rateLimitState.consecutiveFailures++;

  // Exponential backoff: 5s, 10s, 20s, 40s, 60s max
  const backoffMs = Math.min(
    RATE_LIMIT_BACKOFF_MS * Math.pow(2, rateLimitState.consecutiveFailures - 1),
    MAX_BACKOFF_MS,
  );
  rateLimitState.backoffUntil = Date.now() + backoffMs;
}

function recordSuccess(): void {
  rateLimitState.consecutiveFailures = 0;
  rateLimitState.backoffUntil = 0;
}

// Export for testing
export function resetRateLimitState(): void {
  rateLimitState = {
    requestTimestamps: [],
    consecutiveFailures: 0,
    backoffUntil: 0,
  };
}

export async function geocodeLandmark(
  query: string,
  signal?: AbortSignal,
): Promise<LandmarkResult> {
  if (!query.trim()) throw new AppError('GEOCODING_UNAVAILABLE', 'Enter a landmark to search online.');

  // Check rate limit
  const rateLimitCheck = isRateLimited();
  if (rateLimitCheck.limited) {
    const retryAfterSeconds = Math.ceil((rateLimitCheck.retryAfter ?? 0) / 1000);
    throw new AppError(
      'GEOCODING_RATE_LIMITED',
      `Too many geocoding requests. Please try again in ${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}.`,
    );
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query.trim());
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en,my', 'User-Agent': 'MyanmarPCodeSearch/1.0' },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    recordFailure();
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('GEOCODING_UNAVAILABLE', 'Landmark search timed out after 10 seconds.');
    }
    throw new AppError('GEOCODING_UNAVAILABLE', 'Online landmark search is unavailable.', {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    recordFailure();
    if (response.status === 429) {
      throw new AppError('GEOCODING_RATE_LIMITED', 'Geocoding service rate limit exceeded. Please try again later.');
    }
    throw new AppError('GEOCODING_UNAVAILABLE', `Landmark search failed with HTTP ${response.status}.`);
  }

  const contentLength = response.headers.get('Content-Length');
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (Number.isFinite(size) && size > MAX_GEOCODING_RESPONSE_SIZE) {
      throw new AppError(
        'GEOCODING_UNAVAILABLE',
        `Geocoding response is too large. Maximum size is ${(MAX_GEOCODING_RESPONSE_SIZE / 1024).toFixed(0)}KB.`,
      );
    }
  }

  const responseText = await response.text();
  if (responseText.length > MAX_GEOCODING_RESPONSE_SIZE) {
    throw new AppError(
      'GEOCODING_UNAVAILABLE',
      `Geocoding response is too large. Maximum size is ${(MAX_GEOCODING_RESPONSE_SIZE / 1024).toFixed(0)}KB.`,
    );
  }

  const results = JSON.parse(responseText) as NominatimResult[];
  const result = results[0];
  if (!result) {
    recordFailure();
    throw new AppError('GEOCODING_UNAVAILABLE', 'No landmark match was found.');
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    recordFailure();
    throw new AppError('GEOCODING_UNAVAILABLE', 'Landmark service returned invalid coordinates.');
  }

  recordRequest();
  recordSuccess();
  return { latitude, longitude, label: result.display_name };
}
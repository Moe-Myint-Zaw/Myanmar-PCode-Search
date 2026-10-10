import { geocodeLandmark, resetRateLimitState } from './geocoding-service';

// Mock global fetch
const mockFetch = jest.fn() as jest.Mock;
(globalThis as any).fetch = mockFetch;

describe('geocodeLandmark', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitState();
  });

  it('rejects an empty query', async () => {
    await expect(geocodeLandmark(' ')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('rejects a whitespace-only query', async () => {
    await expect(geocodeLandmark('   \t\n')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('rejects a network error during geocoding', async () => {
    (globalThis as any).fetch.mockRejectedValue(new Error('Network unreachable'));

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('rejects a failed HTTP response', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: jest.fn() },
      text: () => Promise.resolve('Internal Server Error'),
    } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('rejects an empty result set', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () => Promise.resolve('[]'),
    } as Response);

    await expect(geocodeLandmark('NonexistentPlace')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('rejects invalid coordinates from the geocoding service', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              lat: 'not a number',
              lon: '96.1',
              display_name: 'Invalid coordinates',
            },
          ]),
        ),
    } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('rejects non-finite coordinates from the geocoding service', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              lat: 'Infinity',
              lon: '96.1',
              display_name: 'Invalid coordinates',
            },
          ]),
        ),
    } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('returns coordinates and label for a successful geocoding result', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              lat: '16.8661',
              lon: '96.1951',
              display_name: 'Yangon, Myanmar',
            },
          ]),
        ),
    } as Response);

    const result = await geocodeLandmark('Yangon');

    expect(result).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
      label: 'Yangon, Myanmar',
    });
  });

  it('respects AbortSignal for cancellation', async () => {
    const controller = new AbortController();
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    (globalThis as any).fetch.mockImplementation(() => {
      controller.abort();
      return Promise.reject(abortError);
    });

    await expect(geocodeLandmark('Yangon', controller.signal)).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('enforces sliding window rate limit (10 requests per minute)', async () => {
    resetRateLimitState();
    (globalThis as any).fetch.mockReset();
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              lat: '16.8661',
              lon: '96.1951',
              display_name: 'Yangon, Myanmar',
            },
          ]),
        ),
    } as Response);

    // Make 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      await expect(geocodeLandmark('Yangon')).resolves.toBeDefined();
    }

    // 11th request should be rate limited
    await expect(geocodeLandmark('Mandalay')).rejects.toMatchObject({
      code: 'GEOCODING_RATE_LIMITED',
    });
  });

  it('applies exponential backoff on consecutive failures', async () => {
    resetRateLimitState();
    (globalThis as any).fetch.mockReset();
    (globalThis as any).fetch.mockRejectedValue(new Error('Network error'));

    // First failure
    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });

    // Second failure should trigger backoff and return rate limited error
    await expect(geocodeLandmark('Mandalay')).rejects.toMatchObject({
      code: 'GEOCODING_RATE_LIMITED',
    });
  });

  it('resets backoff on successful request', async () => {
    // Reset state first to ensure no backoff is active
    resetRateLimitState();
    (globalThis as any).fetch.mockReset();

    // Simulate failure then success
    (globalThis as any).fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: jest.fn() },
        text: () =>
          Promise.resolve(
            JSON.stringify([
              {
                lat: '16.8661',
                lon: '96.1951',
                display_name: 'Yangon, Myanmar',
              },
            ]),
          ),
      } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });

    // Wait for backoff to expire (5 seconds)
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Should succeed after failure and reset backoff
    await expect(geocodeLandmark('Yangon')).resolves.toBeDefined();
  }, 10000);

  it('respects HTTP 429 from the service', async () => {
    resetRateLimitState();
    (globalThis as any).fetch.mockReset();
    (globalThis as any).fetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: jest.fn() },
      text: () => Promise.resolve('Too Many Requests'),
    } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_RATE_LIMITED',
    });
  });

  it('constructs the correct Nominatim URL with query parameters', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              lat: '16.8661',
              lon: '96.1951',
              display_name: 'Yangon, Myanmar',
            },
          ]),
        ),
    } as Response);

    await geocodeLandmark('Yangon');

    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining('nominatim.openstreetmap.org/search'),
      }),
      expect.objectContaining({
        headers: { 'Accept-Language': 'en,my', 'User-Agent': 'MyanmarPCodeSearch/1.0' },
      }),
    );
  });

  it('rejects a response that exceeds the maximum size limit', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue((11_000).toString()) },
      text: () => Promise.resolve('x'.repeat(11_000)),
    } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
    await expect(geocodeLandmark('Yangon')).rejects.toThrow('too large');
  });

  it('rejects a response with Content-Length exceeding the limit', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue((11_000).toString()) },
      text: () => Promise.resolve('small'),
    } as Response);

    await expect(geocodeLandmark('Yangon')).rejects.toMatchObject({
      code: 'GEOCODING_UNAVAILABLE',
    });
    await expect(geocodeLandmark('Yangon')).rejects.toThrow('too large');
  });
});

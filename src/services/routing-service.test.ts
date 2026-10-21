import { AppError } from '@/types/errors';
import { getDrivingRoute } from './routing-service';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const originalFetch = globalThis.fetch;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('getDrivingRoute', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the road geometry, distance, and duration', async () => {
    mockFetch.mockResolvedValue(
      response({
        code: 'Ok',
        routes: [
          {
            distance: 1250,
            duration: 420,
            geometry: { type: 'LineString', coordinates: [[96.1, 16.8], [96.2, 16.9]] },
          },
        ],
      }),
    );

    await expect(
      getDrivingRoute(
        { latitude: 16.8, longitude: 96.1 },
        { latitude: 16.9, longitude: 96.2 },
      ),
    ).resolves.toEqual({
      coordinates: [[96.1, 16.8], [96.2, 16.9]],
      distanceMeters: 1250,
      durationSeconds: 420,
    });
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/route/v1/driving/96.1,16.8;96.2,16.9');
  });

  it('reports when no route exists', async () => {
    mockFetch.mockResolvedValue(response({ code: 'NoRoute', routes: [] }));

    await expect(
      getDrivingRoute(
        { latitude: 16.8, longitude: 96.1 },
        { latitude: 16.9, longitude: 96.2 },
      ),
    ).rejects.toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });

  it('rejects malformed route geometry', async () => {
    mockFetch.mockResolvedValue(
      response({
        code: 'Ok',
        routes: [{ distance: 100, duration: 60, geometry: { type: 'LineString', coordinates: [[0, 0]] } }],
      }),
    );

    await expect(
      getDrivingRoute(
        { latitude: 16.8, longitude: 96.1 },
        { latitude: 16.9, longitude: 96.2 },
      ),
    ).rejects.toMatchObject({ code: 'ROUTE_UNAVAILABLE' });
  });

  it('preserves structured request errors', async () => {
    mockFetch.mockResolvedValue(response({}, 503));

    await expect(
      getDrivingRoute(
        { latitude: 16.8, longitude: 96.1 },
        { latitude: 16.9, longitude: 96.2 },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects invalid endpoint coordinates without requesting a route', async () => {
    await expect(
      getDrivingRoute(
        { latitude: 100, longitude: 96.1 },
        { latitude: 16.9, longitude: 96.2 },
      ),
    ).rejects.toMatchObject({ code: 'ROUTE_UNAVAILABLE' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
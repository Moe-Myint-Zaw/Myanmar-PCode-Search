import { parseCoordinates } from './coordinates';

describe('parseCoordinates', () => {
  it('parses a Google Maps center URL locally', () => {
    expect(parseCoordinates('https://maps.google.com/?q=16.8661,96.1951')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
  });

  it('parses a Google Maps coordinate path', () => {
    expect(parseCoordinates('https://maps.google.com/@16.8661,96.1951,12z')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseCoordinates('91, 96')).toBeNull();
  });

  it('rejects URLs with disallowed schemes', () => {
    expect(parseCoordinates('data:text/plain,16.8661,96.1951')).toBeNull();
    expect(parseCoordinates('file:///coordinates?16.8661,96.1951')).toBeNull();
    expect(parseCoordinates('javascript:alert(1)')).toBeNull();
  });

  it('rejects URLs with disallowed hostnames', () => {
    expect(parseCoordinates('https://evil.com/?q=16.8661,96.1951')).toBeNull();
    expect(parseCoordinates('https://malicious-site.com/?q=16.8661,96.1951')).toBeNull();
    expect(parseCoordinates('https://evil.com/@16.8661,96.1951')).toBeNull();
  });

  it('accepts allowed URL schemes', () => {
    expect(parseCoordinates('https://maps.google.com/?q=16.8661,96.1951')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
    expect(parseCoordinates('http://maps.google.com/?q=16.8661,96.1951')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
  });

  it('accepts OpenStreetMap URLs', () => {
    expect(parseCoordinates('https://openstreetmap.org/?mlat=16.8661&mlon=96.1951')).toBeNull(); // No matching param
    expect(parseCoordinates('https://openstreetmap.org/?q=16.8661,96.1951')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
  });

  it('accepts plain coordinate pairs', () => {
    expect(parseCoordinates('16.8661, 96.1951')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
    expect(parseCoordinates('16.8661 96.1951')).toEqual({
      latitude: 16.8661,
      longitude: 96.1951,
    });
  });
});
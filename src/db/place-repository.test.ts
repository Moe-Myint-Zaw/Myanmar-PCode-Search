import { buildPlaceSearchSql } from './place-repository';

describe('buildPlaceSearchSql', () => {
  it('uses the trigram index for longer substrings and binds the ranking predicates', () => {
    const { sql, parameters } = buildPlaceSearchSql('Yangon', 'village', 25);
    const placeholderCount = (sql.match(/\?/g) ?? []).length;

    expect(placeholderCount).toBe(parameters.length);
    expect(parameters.slice(0, 7)).toEqual([
      'yangon',
      '"yangon"',
      '%yangon%',
      '%yangon%',
      '%yangon%',
      'yangon%',
      'village',
    ]);
    expect(parameters.at(-1)).toBe(25);
    expect(sql).toContain('pcode_normalized = ? THEN 0');
    expect(sql).toContain('postal_code_normalized = ? THEN 1');
    expect(sql).toContain('places_name_fts MATCH ?');
    expect(sql).toContain('\nUNION\n');
  });

  it('retains substring matching for terms shorter than an FTS trigram', () => {
    const { sql, parameters } = buildPlaceSearchSql('oo');

    expect(sql).not.toContain('places_name_fts MATCH ?');
    expect(parameters).toContain('%oo%');
  });

  it('retains normalized postal-code prefix matching when the input includes spaces', () => {
    const { sql, parameters } = buildPlaceSearchSql('11 22');

    expect(sql).toContain('SELECT id FROM places WHERE postal_code_normalized LIKE ?');
    expect(parameters).toContain('1122%');
  });

  it('clamps the result limit and includes the requested type filter', () => {
    const { parameters, sql } = buildPlaceSearchSql('abc', 'town', 10000);
    expect(parameters.at(-1)).toBe(500);
    expect(sql).toContain('AND type = ?');
  });

  it('accepts the ward filter and includes the requested type filter', () => {
    const { sql, parameters } = buildPlaceSearchSql('Yangon', 'ward', 25);

    expect(sql).toContain('AND type = ?');
    expect(parameters).toContain('ward');
  });

  it('rejects invalid place type filter', () => {
    expect(() => buildPlaceSearchSql('Yangon', 'invalid_type' as any)).toThrow(
      'Invalid place type filter',
    );
  });

  it('rejects search query exceeding maximum length', () => {
    const longQuery = 'a'.repeat(201);
    expect(() => buildPlaceSearchSql(longQuery)).toThrow('too long');
  });

  it('accepts search query at maximum length', () => {
    const maxQuery = 'a'.repeat(200);
    expect(() => buildPlaceSearchSql(maxQuery)).not.toThrow();
  });
});
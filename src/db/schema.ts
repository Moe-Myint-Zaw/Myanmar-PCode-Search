export const DATABASE_NAME = 'myanmar_pcode.db';
export const DATABASE_SCHEMA_VERSION = 2;

export const DATABASE_SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    pcode TEXT NOT NULL UNIQUE,
    name_eng TEXT,
    name_mmr TEXT,
    sr_pcode TEXT,
    sr_name TEXT,
    district_pcode TEXT,
    district_name TEXT,
    tsp_pcode TEXT,
    tsp_name TEXT,
    town_pcode TEXT,
    town_name TEXT,
    vt_pcode TEXT,
    vt_name TEXT,
    lat REAL,
    lng REAL,
    coord_source TEXT,
    postal_code TEXT,
    pcode_normalized TEXT NOT NULL,
    postal_code_normalized TEXT NOT NULL,
    name_eng_normalized TEXT NOT NULL,
    name_mmr_normalized TEXT NOT NULL,
    tsp_name_normalized TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS places_pcode_idx ON places(pcode_normalized);
  CREATE INDEX IF NOT EXISTS places_postal_code_idx ON places(postal_code_normalized);
  CREATE INDEX IF NOT EXISTS places_type_idx ON places(type);
  CREATE INDEX IF NOT EXISTS places_sr_pcode_idx ON places(sr_pcode);
  CREATE INDEX IF NOT EXISTS places_district_pcode_idx ON places(district_pcode);
  CREATE INDEX IF NOT EXISTS places_tsp_pcode_idx ON places(tsp_pcode);
  CREATE INDEX IF NOT EXISTS places_town_pcode_idx ON places(town_pcode);
  CREATE INDEX IF NOT EXISTS places_vt_pcode_idx ON places(vt_pcode);
  CREATE INDEX IF NOT EXISTS places_name_eng_idx ON places(name_eng_normalized);
  CREATE INDEX IF NOT EXISTS places_name_mmr_idx ON places(name_mmr_normalized);
  CREATE INDEX IF NOT EXISTS places_tsp_name_idx ON places(tsp_name_normalized);

  CREATE TABLE IF NOT EXISTS place_grid (
    cell_key TEXT NOT NULL,
    place_id INTEGER NOT NULL PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS place_grid_cell_idx ON place_grid(cell_key);

  CREATE TABLE IF NOT EXISTS dataset_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS places_name_fts USING fts5(
    name_eng_normalized,
    name_mmr_normalized,
    tsp_name_normalized,
    postal_code_normalized,
    content = 'places',
    content_rowid = 'id',
    tokenize = 'trigram'
  );

  CREATE TRIGGER IF NOT EXISTS places_name_fts_insert AFTER INSERT ON places BEGIN
    INSERT INTO places_name_fts (
      rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized
    ) VALUES (
      new.id, new.name_eng_normalized, new.name_mmr_normalized, new.tsp_name_normalized, new.postal_code_normalized
    );
  END;

  CREATE TRIGGER IF NOT EXISTS places_name_fts_delete AFTER DELETE ON places BEGIN
    INSERT INTO places_name_fts (
      places_name_fts, rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized
    ) VALUES (
      'delete', old.id, old.name_eng_normalized, old.name_mmr_normalized, old.tsp_name_normalized, old.postal_code_normalized
    );
  END;

  CREATE TRIGGER IF NOT EXISTS places_name_fts_update AFTER UPDATE ON places BEGIN
    INSERT INTO places_name_fts (
      places_name_fts, rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized
    ) VALUES (
      'delete', old.id, old.name_eng_normalized, old.name_mmr_normalized, old.tsp_name_normalized, old.postal_code_normalized
    );
    INSERT INTO places_name_fts (
      rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized
    ) VALUES (
      new.id, new.name_eng_normalized, new.name_mmr_normalized, new.tsp_name_normalized, new.postal_code_normalized
    );
  END;

  PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};
`;
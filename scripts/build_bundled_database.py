#!/usr/bin/env python3
"""Build the validated compact place dataset into the app's bundled SQLite database."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
import tempfile
import unicodedata
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
DATABASE_SCHEMA_VERSION = 2
COORDINATE_SOURCES = {"mimu", "boundary", "villages", "town"}
PLACE_FIELDS = (
    "type",
    "pcode",
    "name_eng",
    "name_mmr",
    "sr_pcode",
    "sr_name",
    "district_pcode",
    "district_name",
    "tsp_pcode",
    "tsp_name",
    "town_pcode",
    "town_name",
    "vt_pcode",
    "vt_name",
    "lat",
    "lng",
    "coord_source",
    "postal_code",
)
SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE places (
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
CREATE INDEX places_pcode_idx ON places(pcode_normalized);
CREATE INDEX places_postal_code_idx ON places(postal_code_normalized);
CREATE INDEX places_type_idx ON places(type);
CREATE INDEX places_sr_pcode_idx ON places(sr_pcode);
CREATE INDEX places_district_pcode_idx ON places(district_pcode);
CREATE INDEX places_tsp_pcode_idx ON places(tsp_pcode);
CREATE INDEX places_town_pcode_idx ON places(town_pcode);
CREATE INDEX places_vt_pcode_idx ON places(vt_pcode);
CREATE INDEX places_name_eng_idx ON places(name_eng_normalized);
CREATE INDEX places_name_mmr_idx ON places(name_mmr_normalized);
CREATE INDEX places_tsp_name_idx ON places(tsp_name_normalized);
CREATE TABLE place_grid (
  cell_key TEXT NOT NULL,
  place_id INTEGER NOT NULL PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE
);
CREATE INDEX place_grid_cell_idx ON place_grid(cell_key);
CREATE TABLE dataset_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE VIRTUAL TABLE places_name_fts USING fts5(
  name_eng_normalized,
  name_mmr_normalized,
  tsp_name_normalized,
  postal_code_normalized,
  content='places',
  content_rowid='id',
  tokenize='trigram'
);
CREATE TRIGGER places_name_fts_insert AFTER INSERT ON places BEGIN
  INSERT INTO places_name_fts (
    rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized
  ) VALUES (
    new.id, new.name_eng_normalized, new.name_mmr_normalized, new.tsp_name_normalized, new.postal_code_normalized
  );
END;
CREATE TRIGGER places_name_fts_delete AFTER DELETE ON places BEGIN
  INSERT INTO places_name_fts (
    places_name_fts, rowid, name_eng_normalized, name_mmr_normalized, tsp_name_normalized, postal_code_normalized
  ) VALUES (
    'delete', old.id, old.name_eng_normalized, old.name_mmr_normalized, old.tsp_name_normalized, old.postal_code_normalized
  );
END;
CREATE TRIGGER places_name_fts_update AFTER UPDATE ON places BEGIN
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
"""
PLACE_INSERT = """
INSERT INTO places (
  type, pcode, name_eng, name_mmr, sr_pcode, sr_name, district_pcode, district_name,
  tsp_pcode, tsp_name, town_pcode, town_name, vt_pcode, vt_name, lat, lng,
  coord_source, postal_code, pcode_normalized, postal_code_normalized,
  name_eng_normalized, name_mmr_normalized, tsp_name_normalized
) VALUES (""" + ",".join("?" for _ in range(23)) + ")"


def normalize(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").lower()
    result: list[str] = []
    previous_space = True
    for character in normalized:
        if unicodedata.category(character)[0] in {"L", "M", "N"}:
            result.append(character)
            previous_space = False
        elif not previous_space:
            result.append(" ")
            previous_space = True
    if result and result[-1] == " ":
        result.pop()
    return "".join(result)


def grid_cell_key(latitude: float, longitude: float) -> str:
    return f"{math.floor(latitude / 0.25)}:{math.floor(longitude / 0.25)}"


def validate_dataset(dataset: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not isinstance(dataset, dict) or not isinstance(dataset.get("metadata"), dict):
        raise ValueError("Dataset must contain metadata and a places array.")
    metadata = dataset["metadata"]
    places = dataset.get("places")
    if not isinstance(places, list) or not places:
        raise ValueError("Dataset contains no place records.")
    if metadata.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("Dataset schema version is unsupported.")
    if metadata.get("recordCount") != len(places):
        raise ValueError("Dataset record count does not match.")
    if not isinstance(metadata.get("datasetVersion"), str) or not metadata["datasetVersion"].strip():
        raise ValueError("Dataset version is required.")
    if not isinstance(metadata.get("source"), str) or not metadata["source"].strip():
        raise ValueError("Dataset source is required.")
    if not isinstance(metadata.get("generatedAt"), str) or not metadata["generatedAt"].strip():
        raise ValueError("Dataset generatedAt is required.")

    canonical = json.dumps(places, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    checksum = hashlib.sha256(canonical).hexdigest()
    if checksum.lower() != str(metadata.get("checksum", "")).lower():
        raise ValueError("Dataset checksum does not match its places array.")

    seen_pcodes: set[str] = set()
    for index, place in enumerate(places, start=1):
        if not isinstance(place, dict):
            raise ValueError(f"Place {index} must be an object.")
        missing = set(PLACE_FIELDS) - place.keys()
        if missing:
            raise ValueError(f"Place {index} is missing fields: {', '.join(sorted(missing))}.")
        if not isinstance(place["type"], str) or not place["type"].strip():
            raise ValueError(f"Place {index} has an invalid type.")
        pcode = place["pcode"]
        if not isinstance(pcode, str) or not pcode.strip() or pcode in seen_pcodes:
            raise ValueError(f"Place {index} has a missing or duplicate PCode.")
        seen_pcodes.add(pcode)
        latitude, longitude = place["lat"], place["lng"]
        if (latitude is None) != (longitude is None):
            raise ValueError(f"Place {pcode} has an incomplete coordinate pair.")
        if latitude is not None:
            if (
                not isinstance(latitude, (float, int))
                or not isinstance(longitude, (float, int))
                or not math.isfinite(latitude)
                or not math.isfinite(longitude)
                or not -90 <= latitude <= 90
                or not -180 <= longitude <= 180
            ):
                raise ValueError(f"Place {pcode} has invalid coordinates.")
            if place["coord_source"] not in COORDINATE_SOURCES:
                raise ValueError(f"Place {pcode} has an unsupported coordinate source.")
        elif place["coord_source"] is not None and place["coord_source"] not in COORDINATE_SOURCES:
            raise ValueError(f"Place {pcode} has an unsupported coordinate source.")
        for field in PLACE_FIELDS:
            value = place[field]
            if field not in {"lat", "lng"} and value is not None and not isinstance(value, str):
                raise ValueError(f"Place {pcode} has an invalid {field} value.")

    return metadata, places


def place_values(place: dict[str, Any]) -> tuple[Any, ...]:
    return (
        *(place[field] for field in PLACE_FIELDS),
        normalize(place["pcode"]).replace(" ", ""),
        normalize(place["postal_code"]).replace(" ", ""),
        normalize(place["name_eng"]),
        normalize(place["name_mmr"]),
        normalize(place["tsp_name"]),
    )


def build_database(input_path: Path, output_path: Path) -> tuple[int, str]:
    dataset = json.loads(input_path.read_text(encoding="utf-8"))
    metadata, places = validate_dataset(dataset)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output_path.name}.", suffix=".tmp", dir=output_path.parent
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        connection = sqlite3.connect(temporary_path)
        try:
            connection.executescript(SCHEMA)
            connection.execute(f"PRAGMA user_version = {DATABASE_SCHEMA_VERSION}")
            connection.executemany(PLACE_INSERT, (place_values(place) for place in places))
            connection.executemany(
                "INSERT INTO place_grid (cell_key, place_id) VALUES (?, ?)",
                (
                    (grid_cell_key(place["lat"], place["lng"]), place_id)
                    for place_id, place in enumerate(places, start=1)
                    if place["lat"] is not None
                ),
            )
            metadata_values = {
                **metadata,
                "installedAt": "",
                "updatedAt": "",
                "datasetOrigin": "bundled",
                "databaseSchemaVersion": DATABASE_SCHEMA_VERSION,
            }
            connection.executemany(
                "INSERT INTO dataset_metadata (key, value) VALUES (?, ?)",
                ((key, str(value)) for key, value in metadata_values.items()),
            )
            connection.commit()

            integrity = connection.execute("PRAGMA integrity_check").fetchone()
            if integrity is None or integrity[0] != "ok":
                raise ValueError(f"SQLite integrity check failed: {integrity}")
            connection.execute(
                "INSERT INTO places_name_fts(places_name_fts, rank) VALUES ('integrity-check', 1)"
            )
            actual_count = connection.execute("SELECT COUNT(*) FROM places").fetchone()[0]
            if actual_count != len(places):
                raise ValueError("SQLite place count does not match dataset metadata.")
            if connection.execute(
                "SELECT COUNT(*) FROM places WHERE rowid != id OR pcode IS NULL"
            ).fetchone()[0]:
                raise ValueError("SQLite place identifiers are invalid.")
            actual_grid_count = connection.execute("SELECT COUNT(*) FROM place_grid").fetchone()[0]
            expected_grid_count = sum(place["lat"] is not None for place in places)
            if actual_grid_count != expected_grid_count:
                raise ValueError("Spatial grid count does not match coordinate-bearing places.")
            for index_name in (
                "places_pcode_idx",
                "places_postal_code_idx",
                "places_type_idx",
                "places_sr_pcode_idx",
                "places_district_pcode_idx",
                "places_tsp_pcode_idx",
                "places_town_pcode_idx",
                "places_vt_pcode_idx",
                "places_name_eng_idx",
                "places_name_mmr_idx",
                "places_tsp_name_idx",
                "place_grid_cell_idx",
            ):
                if connection.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='index' AND name=?",
                    (index_name,),
                ).fetchone() is None:
                    raise ValueError(f"Required SQLite index is missing: {index_name}.")
            if connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='places_name_fts'"
            ).fetchone() is None:
                raise ValueError("Required place-name substring index is missing.")
            for trigger_name in (
                "places_name_fts_insert",
                "places_name_fts_update",
                "places_name_fts_delete",
            ):
                if connection.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?",
                    (trigger_name,),
                ).fetchone() is None:
                    raise ValueError(f"Required place-name search trigger is missing: {trigger_name}.")
        finally:
            connection.close()
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, output_path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise
    return len(places), metadata["datasetVersion"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("data/pcode-compact.json"))
    parser.add_argument(
        "--output", type=Path, default=Path("assets/database/myanmar_pcode.db")
    )
    args = parser.parse_args()
    count, version = build_database(args.input, args.output)
    print(f"Built bundled dataset {version} ({count} places) -> {args.output}")


if __name__ == "__main__":
    main()

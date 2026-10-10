#!/usr/bin/env python3
"""Build the app's compact, checksummed JSON from a normalized places CSV."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
COORDINATE_SOURCES = {"mimu", "boundary", "villages", "town"}
PLACE_FIELDS = [
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
]
NULLABLE_TEXT_FIELDS = {
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
    "coord_source",
    "postal_code",
}


def parse_nullable_number(value: str, field: str, row_number: int) -> float | None:
    if not value.strip():
        return None
    try:
        number = float(value)
    except ValueError as error:
        raise ValueError(f"Row {row_number}: {field} must be numeric.") from error
    if not math.isfinite(number):
        raise ValueError(f"Row {row_number}: {field} must be finite.")
    return int(number) if number.is_integer() else number


def convert_row(row: dict[str, str], row_number: int) -> dict[str, Any]:
    place: dict[str, Any] = {}
    for field in PLACE_FIELDS:
        value = row.get(field, "").strip()
        if field in {"lat", "lng"}:
            place[field] = parse_nullable_number(value, field, row_number)
        elif field in NULLABLE_TEXT_FIELDS:
            place[field] = value or None
        else:
            place[field] = value

    if not place["type"]:
        raise ValueError(f"Row {row_number}: type is required.")
    if not place["pcode"]:
        raise ValueError(f"Row {row_number}: pcode is required.")
    if (place["lat"] is None) != (place["lng"] is None):
        raise ValueError(f"Row {row_number}: latitude and longitude must both be present or both be blank.")
    if place["lat"] is not None:
        if not -90 <= place["lat"] <= 90 or not -180 <= place["lng"] <= 180:
            raise ValueError(f"Row {row_number}: coordinate values are outside valid ranges.")
        if place["coord_source"] not in COORDINATE_SOURCES:
            raise ValueError(f"Row {row_number}: coord_source must be one of {sorted(COORDINATE_SOURCES)}.")
    elif place["coord_source"] and place["coord_source"] not in COORDINATE_SOURCES:
        raise ValueError(f"Row {row_number}: coord_source is not recognized.")
    return place


def build_dataset(input_path: Path, output_path: Path, version: str, source: str) -> dict[str, Any]:
    places: list[dict[str, Any]] = []
    seen_pcodes: set[str] = set()

    with input_path.open("r", encoding="utf-8-sig", newline="") as source_file:
        reader = csv.DictReader(source_file)
        missing = set(PLACE_FIELDS) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

        for row_number, row in enumerate(reader, start=2):
            place = convert_row(row, row_number)
            if place["pcode"] in seen_pcodes:
                raise ValueError(f"Row {row_number}: duplicate PCode {place['pcode']}.")
            seen_pcodes.add(place["pcode"])
            places.append(place)

    if not places:
        raise ValueError("Input CSV contains no place records.")

    canonical_places = json.dumps(places, ensure_ascii=False, separators=(",", ":"))
    dataset = {
        "metadata": {
            "datasetVersion": version,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "source": source,
            "recordCount": len(places),
            "schemaVersion": SCHEMA_VERSION,
            "checksum": hashlib.sha256(canonical_places.encode("utf-8")).hexdigest(),
        },
        "places": places,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dataset


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Normalized places CSV with spec-defined columns")
    parser.add_argument("--output", type=Path, default=Path("data/pcode-compact.json"))
    parser.add_argument("--version", required=True, help="Source dataset version, for example 9.7")
    parser.add_argument("--source", required=True, help="Source provenance string")
    args = parser.parse_args()

    dataset = build_dataset(args.input, args.output, args.version, args.source)
    print(
        f"Built {dataset['metadata']['recordCount']} places, "
        f"dataset {dataset['metadata']['datasetVersion']}, "
        f"SHA-256 {dataset['metadata']['checksum']} -> {args.output}"
    )


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""Normalize the official MIMU / postal / OCHA datasets into the app's canonical places CSV."""

from __future__ import annotations

import csv
from pathlib import Path

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

REQUIRED_FILES = {
    "cod_ab_centroids.csv": "centroids",
    "myanmar_postal_code_data.csv": "postal",
    "pcode9.7_town_data.csv": "town",
    "pcode9.7_village_data.csv": "village",
    "pcode9.7_village_tract_data.csv": "village_tract",
    "pcode9.7_ward_data.csv": "ward",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            return []
        return [
            {key: (value or "").strip() for key, value in row.items()}
            for row in reader
            if row is not None
        ]


def first_non_empty(*values: str) -> str:
    for value in values:
        if value and value.strip():
            return value.strip()
    return ""


def build_postal_map(data_dir: Path) -> dict[str, str]:
    postal_lookup: dict[str, str] = {}
    postal_path = data_dir / "myanmar_postal_code_data.csv"
    if not postal_path.exists():
        return postal_lookup

    for row in read_csv(postal_path):
        for pcode_key in ("Ward_Pcode", "VT_Pcode"):
            code = row.get(pcode_key, "")
            postal_code = row.get("Postal Code", "")
            if code and postal_code:
                postal_lookup.setdefault(code, postal_code)
    return postal_lookup


def build_boundary_lookup(data_dir: Path) -> dict[str, tuple[str, str]]:
    boundary_lookup: dict[str, tuple[str, str]] = {}
    boundary_path = data_dir / "cod_ab_centroids.csv"
    if not boundary_path.exists():
        return boundary_lookup

    for row in read_csv(boundary_path):
        pcode = row.get("pcode", "")
        lat = row.get("center_lat", "")
        lng = row.get("center_lon", "")
        if pcode and lat and lng:
            boundary_lookup.setdefault(pcode, (lat, lng))
    return boundary_lookup


def build_place_record(row: dict[str, str], kind: str, boundary_lookup: dict[str, tuple[str, str]], postal_lookup: dict[str, str]) -> dict[str, str]:
    if kind == "town":
        pcode = row.get("Town_Pcode", "")
    elif kind == "ward":
        pcode = row.get("Ward_Pcode", "")
    elif kind == "village_tract":
        pcode = row.get("VT_Pcode", "")
    elif kind == "village":
        pcode = row.get("Village_Pcode", "")
    else:
        pcode = ""

    if not pcode:
        return {}

    record: dict[str, str] = {
        "type": kind,
        "pcode": pcode,
        "name_eng": "",
        "name_mmr": "",
        "sr_pcode": "",
        "sr_name": "",
        "district_pcode": "",
        "district_name": "",
        "tsp_pcode": "",
        "tsp_name": "",
        "town_pcode": "",
        "town_name": "",
        "vt_pcode": "",
        "vt_name": "",
        "lat": "",
        "lng": "",
        "coord_source": "",
        "postal_code": postal_lookup.get(pcode, ""),
    }

    if kind == "town":
        record["name_eng"] = row.get("Town_Name_Eng", "")
        record["name_mmr"] = row.get("Town_Name_MMR", "")
        record["sr_pcode"] = row.get("SR_Pcode", "")
        record["sr_name"] = row.get("SR_Name_Eng", "")
        record["district_pcode"] = row.get("District/SAZ_Pcode", "")
        record["district_name"] = row.get("District/SAZ_Name_Eng", "")
        record["tsp_pcode"] = row.get("Tsp_Pcode", "")
        record["tsp_name"] = row.get("Township_Name_Eng", "")
        record["lat"] = row.get("Latitude", "")
        record["lng"] = row.get("Longitude", "")
        record["coord_source"] = "town" if record["lat"] and record["lng"] else ""
    elif kind == "ward":
        record["name_eng"] = row.get("Ward_Name_Eng", "")
        record["name_mmr"] = row.get("Ward_Name_MMR", "")
        record["sr_pcode"] = row.get("SR_Pcode", "")
        record["sr_name"] = row.get("SR_Name_Eng", "")
        record["district_pcode"] = row.get("District/SAZ_Pcode", "")
        record["district_name"] = row.get("District/SAZ_Name_Eng", "")
        record["tsp_pcode"] = row.get("Tsp_Pcode", "")
        record["tsp_name"] = row.get("Township_Name_Eng", "")
        record["town_pcode"] = row.get("Town_Pcode", "")
        record["town_name"] = row.get("Town", "")
        if pcode in boundary_lookup:
            record["lat"], record["lng"] = boundary_lookup[pcode]
            record["coord_source"] = "boundary"
    elif kind == "village_tract":
        record["name_eng"] = row.get("Village_Tract_Name_Eng", "")
        record["name_mmr"] = row.get("Village_Tract_Name_MMR", "")
        record["sr_pcode"] = row.get("SR_Pcode", "")
        record["sr_name"] = row.get("SR_Name_Eng", "")
        record["district_pcode"] = row.get("District/SAZ_Pcode", "")
        record["district_name"] = row.get("District/SAZ_Name_Eng", "")
        record["tsp_pcode"] = row.get("Tsp_Pcode", "")
        record["tsp_name"] = row.get("Township_Name_Eng", "")
        record["vt_pcode"] = pcode
        record["vt_name"] = row.get("Village_Tract_Name_Eng", "")
        if pcode in boundary_lookup:
            record["lat"], record["lng"] = boundary_lookup[pcode]
            record["coord_source"] = "boundary"
    elif kind == "village":
        record["name_eng"] = row.get("Village_Name_Eng", "")
        record["name_mmr"] = row.get("Village_Name_MMR", "")
        record["sr_pcode"] = row.get("SR_Pcode", "")
        record["sr_name"] = row.get("SR_Name_Eng", "")
        record["district_pcode"] = row.get("District/SAZ_Pcode", "")
        record["district_name"] = row.get("District/SAZ_Name_Eng", "")
        record["tsp_pcode"] = row.get("Tsp_Pcode", "")
        record["tsp_name"] = row.get("Township_Name_Eng", "")
        record["vt_pcode"] = row.get("VT_Pcode", "")
        record["vt_name"] = row.get("Village_Tract_Name_Eng", "")
        record["lat"] = row.get("Latitude", "")
        record["lng"] = row.get("Longitude", "")
        record["coord_source"] = "villages" if record["lat"] and record["lng"] else ""
    return record


def build_places_csv(data_dir: Path, output_path: Path) -> list[dict[str, str]]:
    missing = [name for name in REQUIRED_FILES if not (data_dir / name).exists()]
    if missing:
        raise FileNotFoundError(f"Missing official dataset files: {', '.join(sorted(missing))}")

    postal_lookup = build_postal_map(data_dir)
    boundary_lookup = build_boundary_lookup(data_dir)
    merged: dict[str, dict[str, str]] = {}

    for kind, filename in (
        ("town", "pcode9.7_town_data.csv"),
        ("ward", "pcode9.7_ward_data.csv"),
        ("village_tract", "pcode9.7_village_tract_data.csv"),
        ("village", "pcode9.7_village_data.csv"),
    ):
        for row in read_csv(data_dir / filename):
            record = build_place_record(row, kind, boundary_lookup, postal_lookup)
            if not record:
                continue
            existing = merged.get(record["pcode"])
            if existing is None:
                merged[record["pcode"]] = record
                continue

            for field in PLACE_FIELDS:
                value = record.get(field, "")
                if value and not existing.get(field, ""):
                    existing[field] = value

            if not existing.get("lat") and record.get("lat"):
                existing["lat"] = record["lat"]
                existing["lng"] = record["lng"]
                existing["coord_source"] = record.get("coord_source", "")

    final_records = sorted(merged.values(), key=lambda row: row["pcode"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=PLACE_FIELDS)
        writer.writeheader()
        writer.writerows(final_records)
    return final_records


def main() -> None:
    from argparse import ArgumentParser

    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data"), help="Directory containing the official datasets")
    parser.add_argument("--output", type=Path, default=Path("data/source/places.csv"), help="Canonical CSV path")
    args = parser.parse_args()

    records = build_places_csv(args.data_dir, args.output)
    print(f"Wrote {len(records)} canonical place rows to {args.output}")


if __name__ == "__main__":
    main()

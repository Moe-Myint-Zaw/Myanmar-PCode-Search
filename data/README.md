# Dataset Inputs

The licensed MIMU, Myanmar Postal Code, and OCHA source files are present in this workspace. The app ships with a prebuilt SQLite database, so users do not need to import or load a dataset file.

Create the canonical source CSV and compact JSON with:

```sh
npm run build:dataset
```

This runs the required normalization and validation steps and then builds the database asset bundled with the app:

```sh
python3 scripts/prepare_official_places_csv.py --data-dir data --output data/source/places.csv
python3 scripts/build_compact_dataset.py \
  --input data/source/places.csv \
  --output data/pcode-compact.json \
  --version 9.7 \
  --source "MIMU PCode 9.7 + Myanmar Postal Code + OCHA COD-AB"
npm run build:database
```

To rebuild only the packaged database after changing `data/pcode-compact.json`, run:

```sh
npm run build:database
```

The generated `assets/database/myanmar_pcode.db` is included in Android and iOS app builds. The app provisions it automatically on first launch and recovers from a missing or invalid local database. Do not remove or hand-edit this generated asset. Its build step validates the dataset SHA-256, record count, unique PCodes, coordinate ranges and provenance, normalized lookup columns, spatial grid, required indexes, and SQLite integrity before replacing the output.

The CSV must include every canonical place column shown below. Leave optional fields blank when absent; do not substitute invented coordinates or provenance.

```text
type,pcode,name_eng,name_mmr,sr_pcode,sr_name,district_pcode,district_name,tsp_pcode,tsp_name,town_pcode,town_name,vt_pcode,vt_name,lat,lng,coord_source,postal_code
```

The compact dataset generator rejects empty datasets, duplicate PCodes, invalid coordinate pairs/ranges, and unknown `coord_source` values. It writes metadata and the SHA-256 digest of the canonical compact `places` JSON array. The mobile database generator reads that build-time input and creates the app's built-in SQLite database; Settings no longer offers a local file import workflow.
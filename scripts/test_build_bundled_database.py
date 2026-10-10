import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from build_bundled_database import build_database, normalize


def sample_dataset():
    places = [
        {
            "type": "town",
            "pcode": "MMR001001",
            "name_eng": "Yangon",
            "name_mmr": "ရန်ကုန်",
            "sr_pcode": "MMR001",
            "sr_name": "Yangon",
            "district_pcode": None,
            "district_name": None,
            "tsp_pcode": "MMR001001",
            "tsp_name": "Dagon",
            "town_pcode": "MMR001001",
            "town_name": "Dagon",
            "vt_pcode": None,
            "vt_name": None,
            "lat": 16.8,
            "lng": 96.1,
            "coord_source": "mimu",
            "postal_code": "11181",
        },
        {
            "type": "village",
            "pcode": "MMR001002",
            "name_eng": "No Coordinates",
            "name_mmr": None,
            "sr_pcode": "MMR001",
            "sr_name": "Yangon",
            "district_pcode": None,
            "district_name": None,
            "tsp_pcode": None,
            "tsp_name": None,
            "town_pcode": None,
            "town_name": None,
            "vt_pcode": None,
            "vt_name": None,
            "lat": None,
            "lng": None,
            "coord_source": None,
            "postal_code": None,
        },
    ]
    canonical = json.dumps(places, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return {
        "metadata": {
            "datasetVersion": "9.7",
            "generatedAt": "2026-10-03T18:36:53Z",
            "source": "Test dataset",
            "recordCount": len(places),
            "schemaVersion": 1,
            "checksum": hashlib.sha256(canonical).hexdigest(),
        },
        "places": places,
    }


class BuildBundledDatabaseTests(unittest.TestCase):
    def test_packaged_database_contains_searchable_dataset_and_valid_schema(self):
        packaged_database = (
            Path(__file__).resolve().parents[1]
            / "assets"
            / "database"
            / "myanmar_pcode.db"
        )
        with sqlite3.connect(packaged_database) as database:
            self.assertEqual(database.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(database.execute("PRAGMA user_version").fetchone()[0], 2)
            metadata = dict(database.execute("SELECT key, value FROM dataset_metadata"))
            self.assertEqual(metadata["datasetOrigin"], "bundled")
            self.assertEqual(
                int(metadata["recordCount"]),
                database.execute("SELECT COUNT(*) FROM places").fetchone()[0],
            )
            self.assertIsNotNone(
                database.execute(
                    "SELECT pcode FROM places WHERE pcode_normalized = ?",
                    ("150001",),
                ).fetchone()
            )
            self.assertIsNotNone(
                database.execute(
                    "SELECT pcode FROM places WHERE name_mmr_normalized = ? LIMIT 1",
                    ("ကျွန်းထိပ်",),
                ).fetchone()
            )
            self.assertEqual(
                database.execute(
                    """
                    SELECT COUNT(*) FROM places_name_fts
                    WHERE places_name_fts MATCH ?
                    """,
                    ('"taungoo"',),
                ).fetchone()[0],
                database.execute(
                    """
                    SELECT COUNT(*) FROM places
                    WHERE name_eng_normalized LIKE ?
                       OR name_mmr_normalized LIKE ?
                       OR tsp_name_normalized LIKE ?
                    """,
                    ("%taungoo%", "%taungoo%", "%taungoo%"),
                ).fetchone()[0],
            )
            postal_code = database.execute(
                "SELECT postal_code FROM places WHERE postal_code IS NOT NULL LIMIT 1"
            ).fetchone()[0]
            self.assertIsNotNone(
                database.execute(
                    "SELECT pcode FROM places WHERE postal_code_normalized = ? LIMIT 1",
                    (normalize(postal_code).replace(" ", ""),),
                ).fetchone()
            )

    def test_builds_database_with_search_metadata_and_spatial_grid(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "dataset.json"
            output_path = Path(directory) / "myanmar_pcode.db"
            input_path.write_text(json.dumps(sample_dataset(), ensure_ascii=False), encoding="utf-8")

            count, version = build_database(input_path, output_path)

            self.assertEqual((count, version), (2, "9.7"))
            with sqlite3.connect(output_path) as database:
                self.assertEqual(database.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(database.execute("PRAGMA user_version").fetchone()[0], 2)
                result = database.execute(
                    "SELECT name_mmr_normalized, pcode_normalized FROM places WHERE pcode = ?",
                    ("MMR001001",),
                ).fetchone()
                self.assertEqual(result, ("ရန်ကုန်", "mmr001001"))
                self.assertEqual(
                    database.execute("SELECT cell_key FROM place_grid").fetchone()[0],
                    "67:384",
                )
                metadata = dict(database.execute("SELECT key, value FROM dataset_metadata"))
                self.assertEqual(metadata["datasetOrigin"], "bundled")
                self.assertEqual(metadata["recordCount"], "2")
                indexed_match = database.execute(
                    """
                    SELECT places.pcode FROM places_name_fts
                    JOIN places ON places.id = places_name_fts.rowid
                    WHERE places_name_fts MATCH ?
                    """,
                    ('"ango"',),
                ).fetchone()
                self.assertEqual(indexed_match[0], "MMR001001")

    def test_rejects_invalid_input_without_replacing_existing_database(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "dataset.json"
            output_path = Path(directory) / "myanmar_pcode.db"
            output_path.write_bytes(b"existing database")
            dataset = sample_dataset()
            dataset["metadata"]["checksum"] = "0" * 64
            input_path.write_text(json.dumps(dataset, ensure_ascii=False), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "checksum"):
                build_database(input_path, output_path)

            self.assertEqual(output_path.read_bytes(), b"existing database")


if __name__ == "__main__":
    unittest.main()

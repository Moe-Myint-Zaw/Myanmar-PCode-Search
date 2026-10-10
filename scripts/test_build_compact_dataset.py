import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from build_compact_dataset import PLACE_FIELDS, build_dataset


class BuildCompactDatasetTests(unittest.TestCase):
    def write_csv(self, path: Path, rows: list[dict[str, str]]) -> None:
        with path.open("w", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=PLACE_FIELDS)
            writer.writeheader()
            writer.writerows(rows)

    def valid_row(self, **overrides: str) -> dict[str, str]:
        row = {field: "" for field in PLACE_FIELDS}
        row.update(type="village", pcode="MMR001001001", lat="16.8", lng="96.1", coord_source="mimu")
        row.update(overrides)
        return row

    def test_checksum_matches_canonical_json_array(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "places.csv"
            output = Path(directory) / "compact.json"
            self.write_csv(source, [self.valid_row(name_mmr="ရန်ကုန်")])

            dataset = build_dataset(source, output, "9.7", "MIMU + Postal + OCHA")

            canonical = json.dumps(dataset["places"], ensure_ascii=False, separators=(",", ":"))
            checksum = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            self.assertEqual(dataset["metadata"]["checksum"], checksum)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), dataset)

    def test_rejects_duplicate_pcodes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "places.csv"
            output = Path(directory) / "compact.json"
            self.write_csv(source, [self.valid_row(), self.valid_row()])

            with self.assertRaisesRegex(ValueError, "duplicate PCode"):
                build_dataset(source, output, "9.7", "MIMU")

    def test_rejects_approximate_source_invention(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "places.csv"
            output = Path(directory) / "compact.json"
            self.write_csv(source, [self.valid_row(coord_source="surveyed")])

            with self.assertRaisesRegex(ValueError, "coord_source"):
                build_dataset(source, output, "9.7", "MIMU")


if __name__ == "__main__":
    unittest.main()
import csv
import tempfile
import unittest
from pathlib import Path

from prepare_official_places_csv import PLACE_FIELDS, build_places_csv


class PrepareOfficialPlacesCsvTests(unittest.TestCase):
    def write_csv(self, path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def test_build_places_csv_merges_official_sources(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            self.write_csv(
                data_dir / "myanmar_postal_code_data.csv",
                [{"Region": "Nay Pyi Taw", "Postal Code": "1501001", "Ward_Pcode": "MMR018002701501", "VT_Pcode": ""}],
                ["Region", "Postal Code", "Ward_Pcode", "VT_Pcode"],
            )
            self.write_csv(
                data_dir / "pcode9.7_ward_data.csv",
                [{
                    "SR_Pcode": "MMR018",
                    "SR_Name_Eng": "Nay Pyi Taw",
                    "District/SAZ_Pcode": "MMR018D001",
                    "District/SAZ_Name_Eng": "Nay Pyi Taw",
                    "Tsp_Pcode": "MMR018002",
                    "Township_Name_Eng": "Za Bu Thi Ri",
                    "Town_Pcode": "MMR018002701",
                    "Town": "Za Bu Thi Ri Town",
                    "Ward_Pcode": "MMR018002701501",
                    "Ward_Name_Eng": "No (1) Ward",
                    "Ward_Name_MMR": "အမှတ် (၁) ရပ်ကွက်",
                }],
                ["SR_Pcode", "SR_Name_Eng", "District/SAZ_Pcode", "District/SAZ_Name_Eng", "Tsp_Pcode", "Township_Name_Eng", "Town_Pcode", "Town", "Ward_Pcode", "Ward_Name_Eng", "Ward_Name_MMR"],
            )
            self.write_csv(
                data_dir / "pcode9.7_village_data.csv",
                [{
                    "SR_Pcode": "MMR018",
                    "SR_Name_Eng": "Nay Pyi Taw",
                    "District/SAZ_Pcode": "MMR018D001",
                    "District/SAZ_Name_Eng": "Nay Pyi Taw",
                    "Tsp_Pcode": "MMR018002",
                    "Township_Name_Eng": "Za Bu Thi Ri",
                    "VT_Pcode": "MMR018002701",
                    "Village_Tract_Name_Eng": "Zay Ya Theik Di",
                    "Village_Pcode": "MMR018002701001",
                    "Village_Name_Eng": "Aye Village",
                    "Village_Name_MMR": "အေးရွာ",
                    "Latitude": "16.8",
                    "Longitude": "96.1",
                }],
                ["SR_Pcode", "SR_Name_Eng", "District/SAZ_Pcode", "District/SAZ_Name_Eng", "Tsp_Pcode", "Township_Name_Eng", "VT_Pcode", "Village_Tract_Name_Eng", "Village_Pcode", "Village_Name_Eng", "Village_Name_MMR", "Latitude", "Longitude"],
            )
            self.write_csv(
                data_dir / "pcode9.7_village_tract_data.csv",
                [{
                    "SR_Pcode": "MMR018",
                    "SR_Name_Eng": "Nay Pyi Taw",
                    "District/SAZ_Pcode": "MMR018D001",
                    "District/SAZ_Name_Eng": "Nay Pyi Taw",
                    "Tsp_Pcode": "MMR018002",
                    "Township_Name_Eng": "Za Bu Thi Ri",
                    "VT_Pcode": "MMR018002702",
                    "Village_Tract_Name_Eng": "Zay Ya Theik Di",
                    "Village_Tract_Name_MMR": "ဇေယျသိဒ္ဓိ",
                }],
                ["SR_Pcode", "SR_Name_Eng", "District/SAZ_Pcode", "District/SAZ_Name_Eng", "Tsp_Pcode", "Township_Name_Eng", "VT_Pcode", "Village_Tract_Name_Eng", "Village_Tract_Name_MMR"],
            )
            self.write_csv(
                data_dir / "pcode9.7_town_data.csv",
                [{
                    "SR_Pcode": "MMR018",
                    "SR_Name_Eng": "Nay Pyi Taw",
                    "District/SAZ_Pcode": "MMR018D001",
                    "District/SAZ_Name_Eng": "Nay Pyi Taw",
                    "Tsp_Pcode": "MMR018002",
                    "Township_Name_Eng": "Za Bu Thi Ri",
                    "Town_Pcode": "MMR018002701",
                    "Town_Name_Eng": "Za Bu Thi Ri Town",
                    "Town_Name_MMR": "ဇေယျသိဒ္ဓိ",
                    "Longitude": "96.1",
                    "Latitude": "16.8",
                }],
                ["SR_Pcode", "SR_Name_Eng", "District/SAZ_Pcode", "District/SAZ_Name_Eng", "Tsp_Pcode", "Township_Name_Eng", "Town_Pcode", "Town_Name_Eng", "Town_Name_MMR", "Longitude", "Latitude"],
            )
            self.write_csv(
                data_dir / "cod_ab_centroids.csv",
                [{"pcode": "MMR018002701501", "center_lat": "16.81", "center_lon": "96.12"}],
                ["pcode", "center_lat", "center_lon"],
            )

            output = data_dir / "source" / "places.csv"
            records = build_places_csv(data_dir, output)

            self.assertEqual(len(records), 4)
            self.assertEqual(
                {record["pcode"] for record in records},
                {"MMR018002701", "MMR018002702", "MMR018002701501", "MMR018002701001"},
            )
            with (output).open("r", encoding="utf-8", newline="") as handle:
                header = next(csv.reader(handle))
            self.assertEqual(header, PLACE_FIELDS)
            self.assertTrue(any(record["pcode"] == "MMR018002701501" and record["postal_code"] == "1501001" for record in records))


if __name__ == "__main__":
    unittest.main()

import json
from pathlib import Path
import shutil
import tempfile
import unittest

from lol_atlas_pipeline.versions import PatchVersion, latest_patch
from lol_atlas_pipeline.normalize import item_tier, normalize_sqlite_item_tiers


class PatchVersionTests(unittest.TestCase):
    def test_numeric_sorting(self) -> None:
        self.assertGreater(PatchVersion.parse("16.18.1"), PatchVersion.parse("16.9.1"))

    def test_latest_patch(self) -> None:
        self.assertEqual(latest_patch(["16.9.1", "16.18.1", "15.24.2"]), "16.18.1")

    def test_invalid_patch(self) -> None:
        with self.assertRaises(ValueError):
            PatchVersion.parse("latest")

    def test_item_tier_uses_final_graph(self) -> None:
        self.assertEqual(item_tier(False, False), "独立")
        self.assertEqual(item_tier(False, True), "基础件")
        self.assertEqual(item_tier(True, True), "史诗")
        self.assertEqual(item_tier(True, False), "成品")

    def test_current_sqlite_release_is_normalized(self) -> None:
        patch = json.loads(Path("public/data/lol.json").read_text(encoding="utf-8"))["meta"]["version"]
        source = Path("data/releases") / patch / "lol.db"
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "lol.db"
            shutil.copy2(source, copy)
            self.assertEqual(normalize_sqlite_item_tiers(copy), 0)


if __name__ == "__main__":
    unittest.main()

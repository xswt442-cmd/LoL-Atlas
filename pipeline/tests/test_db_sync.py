"""`sync-db` / `verify-db` 的行为。

重点不在"能写入"，而在三件更容易被忽略的事：
1. 库里那些**快照不携带**的列（技能各级冷却等）必须原样留着 —— 这正是本命令只做增量同步的理由；
2. 快照没有的字段留 NULL，而不是写 0（0 会被读成"真的是 0"）；
3. 空跑一次不能碰文件 —— 否则每次跑发布流程，库的 sha256 都会变。
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from lol_atlas_pipeline.db_sync import (
    CHAMPION_COLUMNS,
    META_SNAPSHOT_KEY,
    sync_release_database,
    verify_release_database,
)

SCHEMA_PATH = Path("pipeline/schema.sql")

# 旧库里**没有**的列。`attackdamage_per_level` 不在其中 —— 那一列一直存在，只是值恒为 0
# （ddragon 对该字段全量为 0），本次要修的是它的值，不是加列。
NEW_COLUMNS = tuple(column for column, _type in CHAMPION_COLUMNS if column != "attackdamage_per_level")


def snapshot_for(version: str, champions: list[dict]) -> dict:
    return {"meta": {"version": version}, "champions": champions}


class DbSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.directory, ignore_errors=True)
        self.database = self.directory / "lol.db"
        self.snapshot = self.directory / "lol.json"

    # ---- 夹具 ----

    def build_legacy_database(self, champions: list[dict], version: str = "16.18.1") -> None:
        """造一个"补丁之前"的库：schema 建好后再把补丁列删掉。

        顺带留下两类**快照没有的东西**，用来验证同步不会把它们抹掉：
        自带数据的 `icon` 列，以及 champion_spells 里的各级冷却。
        """
        connection = sqlite3.connect(self.database)
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        for column in NEW_COLUMNS:
            connection.execute(f"ALTER TABLE champions DROP COLUMN {column}")
        for champion in champions:
            connection.execute(
                "INSERT INTO champions (key, id, name, hp, attackdamage, attackdamage_per_level, icon) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    champion["key"], champion["id"], champion["name"],
                    champion.get("hp"), champion.get("attackdamage"),
                    # 旧库里的 AD 成长是 0（ddragon 全量如此），正是要修的那一项
                    0, f"https://example.invalid/{champion['id']}.png",
                ),
            )
            connection.execute(
                "INSERT INTO champion_spells (id, champion_key, slot, name, cooldown_levels) VALUES (?, ?, ?, ?, ?)",
                (int(champion["key"]), champion["key"], "Q", "测试技能", "[1,2,3,4,5]"),
            )
        connection.execute("INSERT INTO meta (key, value) VALUES ('version', ?)", (version,))
        connection.commit()
        connection.close()

    def write_snapshot(self, champions: list[dict], version: str = "16.18.1") -> None:
        self.snapshot.write_text(
            json.dumps(snapshot_for(version, champions), ensure_ascii=False), encoding="utf-8"
        )

    def digest(self) -> str:
        return hashlib.sha256(self.database.read_bytes()).hexdigest()

    def champion(self, **overrides: object) -> dict:
        base = {
            "key": "64", "id": "LeeSin", "name": "李青", "hp": 645, "attackdamage": 66,
            "attackdamage_per_level": 3.4, "attackspeed_ratio": 0.651, "crit_damage": 2,
            "pathing_radius": 35, "selection_radius": 102.78, "selection_height": 225,
            "acquisition_range": 400, "blurb_en": "A master of Ionia's ancient martial arts.",
            "initial": "L",
        }
        base.update(overrides)
        return base

    # ---- 用例 ----

    def test_fills_the_patch_columns(self) -> None:
        champions = [self.champion()]
        self.build_legacy_database(champions)
        self.write_snapshot(champions)

        report = sync_release_database(self.database, self.snapshot)

        self.assertTrue(report.wrote)
        self.assertEqual(
            {column.split(".", 1)[1] for column in report.added_columns},
            set(NEW_COLUMNS),
        )
        self.assertEqual(report.updated_columns["attackdamage_per_level"], 1)
        self.assertTrue(report.clean, report.drift)
        with closing(sqlite3.connect(self.database)) as connection:
            row = connection.execute(
                "SELECT attackdamage_per_level, attackspeed_ratio, blurb_en, initial FROM champions"
            ).fetchone()
        self.assertEqual(row, (3.4, 0.651, "A master of Ionia's ancient martial arts.", "L"))

    def test_keeps_columns_the_snapshot_does_not_carry(self) -> None:
        """库独有的列（这里以 icon 与技能各级冷却为代表）不能被同步抹掉。"""
        champions = [self.champion()]
        self.build_legacy_database(champions)
        self.write_snapshot(champions)
        sync_release_database(self.database, self.snapshot)

        with closing(sqlite3.connect(self.database)) as connection:
            icon = connection.execute("SELECT icon FROM champions").fetchone()[0]
            levels = connection.execute("SELECT cooldown_levels FROM champion_spells").fetchone()[0]
        self.assertEqual(icon, "https://example.invalid/LeeSin.png")
        self.assertEqual(levels, "[1,2,3,4,5]")

    def test_missing_value_stays_null_instead_of_zero(self) -> None:
        champions = [self.champion(key="22", id="Ashe", acquisition_range=None)]
        champions[0].pop("acquisition_range")
        self.build_legacy_database(champions)
        self.write_snapshot(champions)

        report = sync_release_database(self.database, self.snapshot)

        self.assertTrue(report.clean, report.drift)
        with closing(sqlite3.connect(self.database)) as connection:
            value = connection.execute("SELECT acquisition_range FROM champions").fetchone()[0]
        self.assertIsNone(value)

    def test_second_run_does_not_touch_the_file(self) -> None:
        champions = [self.champion()]
        self.build_legacy_database(champions)
        self.write_snapshot(champions)

        sync_release_database(self.database, self.snapshot)
        after_first = self.digest()
        report = sync_release_database(self.database, self.snapshot)

        self.assertFalse(report.wrote)
        self.assertEqual(report.updated_rows, 0)
        self.assertEqual(after_first, self.digest(), "空跑一次不该改动文件，否则每次发布 sha256 都会变")

    def test_verify_detects_drift(self) -> None:
        champions = [self.champion()]
        self.build_legacy_database(champions)
        self.write_snapshot(champions)
        sync_release_database(self.database, self.snapshot)
        self.assertTrue(verify_release_database(self.database, self.snapshot).clean)

        with closing(sqlite3.connect(self.database)) as connection:
            connection.execute("UPDATE champions SET attackdamage_per_level = 0")
            connection.commit()
        drift = verify_release_database(self.database, self.snapshot).drift

        self.assertTrue(any("attackdamage_per_level" in line for line in drift), drift)

    def test_verify_reports_missing_columns_before_sync(self) -> None:
        champions = [self.champion()]
        self.build_legacy_database(champions)
        self.write_snapshot(champions)

        report = verify_release_database(self.database, self.snapshot)

        self.assertEqual(len(report.added_columns), len(NEW_COLUMNS))
        self.assertFalse(report.clean)

    def test_refuses_a_snapshot_from_another_patch(self) -> None:
        self.build_legacy_database([self.champion()], version="16.18.1")
        self.write_snapshot([self.champion()], version="16.19.1")

        with self.assertRaises(ValueError):
            sync_release_database(self.database, self.snapshot)

    def test_records_the_snapshot_digest(self) -> None:
        champions = [self.champion()]
        self.build_legacy_database(champions)
        self.write_snapshot(champions)
        sync_release_database(self.database, self.snapshot)

        with closing(sqlite3.connect(self.database)) as connection:
            recorded = connection.execute(
                "SELECT value FROM meta WHERE key = ?", (META_SNAPSHOT_KEY,)
            ).fetchone()[0]
        self.assertEqual(recorded, hashlib.sha256(self.snapshot.read_bytes()).hexdigest())

    def test_fills_skin_chroma_counts_and_keeps_the_flag(self) -> None:
        """`chroma_count` 是数量（与 CommunityDragon 一致）；`chromas` 是布尔，两者并存。

        快照里"霸天剑魔"有 3 个炫彩，而旧库的 `chromas` 记的是 ddragon 的布尔标志（1）。
        同步之后数量列应为 3，布尔列必须原样保留 —— 那是另一个口径，不是错误数据。
        """
        champion = self.champion()
        champion["skins"] = [
            {"num": 0, "name": "默认", "chroma_count": 0},
            {"num": 2, "name": "霸天剑魔 亚托克斯", "chroma_count": 3},
        ]
        self.build_legacy_database([champion])
        with closing(sqlite3.connect(self.database)) as connection:
            connection.executemany(
                "INSERT INTO champion_skins (champion_key, num, name, chromas) VALUES (?, ?, ?, ?)",
                [
                    (champion["key"], 0, "默认", 0),
                    (champion["key"], 2, "霸天剑魔 亚托克斯", 1),
                ],
            )
            connection.commit()
        self.write_snapshot([champion])

        report = sync_release_database(self.database, self.snapshot)

        self.assertTrue(report.clean, report.drift)
        self.assertEqual(report.updated_columns.get("chroma_count"), 2)
        with closing(sqlite3.connect(self.database)) as connection:
            chroma_count, chromas = connection.execute(
                "SELECT chroma_count, chromas FROM champion_skins WHERE champion_key = ? AND num = 2",
                (champion["key"],),
            ).fetchone()
        self.assertEqual(chroma_count, 3)
        self.assertEqual(chromas, 1, "布尔标志是另一个口径，同步数量时不能动它")

    def test_skins_only_in_the_database_are_left_alone(self) -> None:
        """库比快照多的皮肤行（炫彩条目）不在同步范围，也不该被当成不一致。"""
        champion = self.champion()
        champion["skins"] = [{"num": 2, "name": "霸天剑魔 亚托克斯", "chroma_count": 3}]
        self.build_legacy_database([champion])
        with closing(sqlite3.connect(self.database)) as connection:
            connection.executemany(
                "INSERT INTO champion_skins (champion_key, num, name, chromas) VALUES (?, ?, ?, ?)",
                [
                    (champion["key"], 2, "霸天剑魔 亚托克斯", 1),
                    (champion["key"], 4, "霸天剑魔 亚托克斯 暗色死神", 0),
                ],
            )
            connection.commit()
        self.write_snapshot([champion])

        report = sync_release_database(self.database, self.snapshot)

        self.assertTrue(report.clean, report.drift)
        with closing(sqlite3.connect(self.database)) as connection:
            name = connection.execute(
                "SELECT name FROM champion_skins WHERE champion_key = ? AND num = 4", (champion["key"],)
            ).fetchone()[0]
        self.assertEqual(name, "霸天剑魔 亚托克斯 暗色死神")

    def test_published_release_database_matches_the_snapshot(self) -> None:
        """已发布的库必须与快照同步。

        与 `test_current_sqlite_release_is_normalized` 同一个意图：把"跑过发布流程"这件事
        变成一条 CI 断言。否则补丁脚本改了快照、没人同步库，产物就会长期不一致。
        """
        snapshot = Path("public/data/lol.json")
        patch = json.loads(snapshot.read_text(encoding="utf-8"))["meta"]["version"]
        database = Path("data/releases") / patch / "lol.db"
        if not database.exists():
            self.skipTest(f"{database} 不存在")

        report = verify_release_database(database, snapshot)

        self.assertEqual(report.drift[:5], [])


if __name__ == "__main__":
    unittest.main()

"""把发布快照里「补丁脚本新增的字段」同步进已发布的 sqlite 库。

## 为什么不是「从 lol.json 重建库」

库里有**快照不携带**的列，从快照重建会静默丢掉它们：技能各级冷却 / 消耗 / 射程
（`champion_spells.cooldown_levels` / `cost_levels` / `range_levels`，各 692 行）和技能图
（`image`，865 行）。这些来自造库那一步的原始抓取数据，不在 `lol.json` 里。
所以这里只做**增量同步**：库的其余内容原样不动。

## 同步哪些列

`lib/` 那两个补丁脚本（`enrich-champion-stats.mjs`、`enrich-champion-fields.mjs`）往快照里加的字段：

英雄表：

    attackdamage_per_level   库里是 0（ddragon 对该字段全量为 0，见补数据脚本）
    attackspeed_ratio        库缺列
    crit_damage              库缺列
    pathing_radius           库缺列
    selection_radius         库缺列
    selection_height         库缺列
    acquisition_range        库缺列（12 个英雄没有，留 NULL）
    blurb_en                 库缺列
    initial                  库缺列

皮肤表：

    chroma_count             真正的炫彩**数量**（与 CommunityDragon 逐条一致，2116/2121）

## 明确不同步的

皮肤表的 `chromas` 布尔保持原样 —— 它是 ddragon 的标志（这个皮肤有没有炫彩，取值只有 0/1），
和 `chroma_count` **不是同一个量**，两者并存，谁也不覆盖谁。
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from dataclasses import dataclass, field
from pathlib import Path

# 列名 → sqlite 类型。快照里缺失时留 NULL，不写 0 —— 写 0 会被读成"真的是 0"
CHAMPION_COLUMNS: tuple[tuple[str, str], ...] = (
    ("attackdamage_per_level", "REAL"),
    ("attackspeed_ratio", "REAL"),
    ("crit_damage", "REAL"),
    ("pathing_radius", "REAL"),
    ("selection_radius", "REAL"),
    ("selection_height", "REAL"),
    ("acquisition_range", "REAL"),
    ("blurb_en", "TEXT"),
    ("initial", "TEXT"),
)

# 皮肤：数量列，键是 (champion_key, num)。布尔 `chromas` 不在此列（口径不同，见模块说明）
SKIN_COLUMNS: tuple[tuple[str, str], ...] = (
    ("chroma_count", "INTEGER"),
)

META_SNAPSHOT_KEY = "snapshot_sha256"


@dataclass
class SyncReport:
    """同步/校验的结果。`drift` 非空即表示两边不一致。"""

    added_columns: list[str] = field(default_factory=list)
    updated_rows: int = 0
    updated_columns: dict[str, int] = field(default_factory=dict)
    drift: list[str] = field(default_factory=list)
    wrote: bool = False

    @property
    def clean(self) -> bool:
        return not self.drift


def _snapshot_sha256(snapshot: Path) -> str:
    return hashlib.sha256(snapshot.read_bytes()).hexdigest()


def _load_snapshot(snapshot: Path) -> dict:
    return json.loads(snapshot.read_text(encoding="utf-8"))


def _same(stored: object, expected: object) -> bool:
    """比较库里的值与快照里的值。数值用容差（REAL 存储会带来浮点噪声），其余精确比较。"""
    if stored is None or expected is None:
        return stored is None and expected is None
    if isinstance(expected, bool) or isinstance(stored, bool):
        return stored == expected
    if isinstance(expected, (int, float)) and isinstance(stored, (int, float)):
        return abs(float(stored) - float(expected)) < 1e-9
    return stored == expected


def _missing_columns(database: sqlite3.Connection, table: str, columns) -> list[str]:
    present = {row[1] for row in database.execute(f"PRAGMA table_info({table})")}
    return [column for column, _ in columns if column not in present]


def _check_versions(database: sqlite3.Connection, data: dict, database_path: Path) -> None:
    """库与快照必须是同一个版本，否则对比毫无意义。"""
    row = database.execute("SELECT value FROM meta WHERE key = 'version'").fetchone()
    database_version = row[0] if row else None
    snapshot_version = data.get("meta", {}).get("version")
    if database_version != snapshot_version:
        raise ValueError(
            f"{database_path} 的 meta.version 是 {database_version!r}，"
            f"快照是 {snapshot_version!r} —— 先确认两边是同一个版本"
        )


def _skin_expectations(data: dict) -> dict[tuple[str, int], dict[str, object]]:
    """快照里每个皮肤应有的补丁字段，按 (champion_key, num) 索引。"""
    expected: dict[tuple[str, int], dict[str, object]] = {}
    for champion in data["champions"]:
        for skin in champion.get("skins", []):
            expected[(champion["key"], skin["num"])] = {
                column: skin.get(column) for column, _ in SKIN_COLUMNS
            }
    return expected


def verify_release_database(database_path: Path, snapshot_path: Path) -> SyncReport:
    """只比较不写入：逐列核对，返回不一致项。"""
    data = _load_snapshot(snapshot_path)
    report = SyncReport()
    with closing(sqlite3.connect(database_path)) as database:
        _check_versions(database, data, database_path)

        # 英雄表
        missing = _missing_columns(database, "champions", CHAMPION_COLUMNS)
        report.added_columns.extend(f"champions.{column}" for column in missing)
        existing = [column for column, _ in CHAMPION_COLUMNS if column not in missing]
        selected = ", ".join(existing) if existing else "key"
        stored = {
            row[0]: dict(zip(existing, row[1:]))
            for row in database.execute(f"SELECT key, {selected} FROM champions")
        }
        for champion in data["champions"]:
            row = stored.get(champion["key"])
            if row is None:
                report.drift.append(f"库中缺少英雄 {champion['id']}（key={champion['key']}）")
                continue
            for column, _type in CHAMPION_COLUMNS:
                if column in missing:
                    if champion.get(column) is not None:
                        report.drift.append(f"{champion['id']}.{column}: 库缺列，快照为 {champion[column]!r}")
                    continue
                if not _same(row[column], champion.get(column)):
                    report.drift.append(
                        f"{champion['id']}.{column}: 库 {row[column]!r} vs 快照 {champion.get(column)!r}"
                    )

        # 皮肤表
        skin_missing = _missing_columns(database, "champion_skins", SKIN_COLUMNS)
        report.added_columns.extend(f"champion_skins.{column}" for column in skin_missing)
        skin_existing = [column for column, _ in SKIN_COLUMNS if column not in skin_missing]
        skin_selected = ", ".join(["champion_key", "num", *skin_existing])
        stored_skins = {
            (row[0], row[1]): dict(zip(skin_existing, row[2:]))
            for row in database.execute(f"SELECT {skin_selected} FROM champion_skins")
        }
        for key, expected in _skin_expectations(data).items():
            row = stored_skins.get(key)
            if row is None:
                report.drift.append(f"库中缺少皮肤 {key[0]}#{key[1]}")
                continue
            for column, _type in SKIN_COLUMNS:
                if column in skin_missing:
                    if expected[column] is not None:
                        report.drift.append(f"皮肤 {key[0]}#{key[1]}.{column}: 库缺列，快照为 {expected[column]!r}")
                    continue
                if not _same(row[column], expected[column]):
                    report.drift.append(
                        f"皮肤 {key[0]}#{key[1]}.{column}: 库 {row[column]!r} vs 快照 {expected[column]!r}"
                    )

        recorded = database.execute("SELECT value FROM meta WHERE key = ?", (META_SNAPSHOT_KEY,)).fetchone()
        if recorded is None or recorded[0] != _snapshot_sha256(snapshot_path):
            report.drift.append(f"meta.{META_SNAPSHOT_KEY} 与当前快照不符")
    return report


def sync_release_database(database_path: Path, snapshot_path: Path) -> SyncReport:
    """把快照里的补丁字段写进库。没有变化就完全不碰文件（保证可重复执行、sha256 稳定）。"""
    data = _load_snapshot(snapshot_path)
    report = SyncReport()
    digest = _snapshot_sha256(snapshot_path)

    # pending: (表名, 主键, 列名, 值)。主键在 champions 里是 key 字符串，在皮肤表里是 (key, num)
    pending: list[tuple[str, object, str, object]] = []
    added: list[str] = []

    with closing(sqlite3.connect(database_path)) as database:
        _check_versions(database, data, database_path)

        # ---- 英雄表：先算出要改什么，再决定要不要写 ----
        missing = _missing_columns(database, "champions", CHAMPION_COLUMNS)
        added.extend(f"champions.{column}" for column in missing)
        existing = [column for column, _ in CHAMPION_COLUMNS if column not in missing]
        selected = ", ".join(existing) if existing else "key"
        stored = {
            row[0]: dict(zip(existing, row[1:]))
            for row in database.execute(f"SELECT key, {selected} FROM champions")
        }
        for champion in data["champions"]:
            row = stored.get(champion["key"])
            for column, _type in CHAMPION_COLUMNS:
                expected = champion.get(column)
                if column in missing:
                    # 新列：只要快照有值就写（没有就留 NULL）
                    if expected is not None:
                        pending.append(("champions", champion["key"], column, expected))
                    continue
                if row is None or not _same(row[column], expected):
                    pending.append(("champions", champion["key"], column, expected))

        # ---- 皮肤表 ----
        skin_missing = _missing_columns(database, "champion_skins", SKIN_COLUMNS)
        added.extend(f"champion_skins.{column}" for column in skin_missing)
        skin_existing = [column for column, _ in SKIN_COLUMNS if column not in skin_missing]
        skin_selected = ", ".join(["champion_key", "num", *skin_existing])
        stored_skins = {
            (row[0], row[1]): dict(zip(skin_existing, row[2:]))
            for row in database.execute(f"SELECT {skin_selected} FROM champion_skins")
        }
        for key, expected in _skin_expectations(data).items():
            row = stored_skins.get(key)
            for column, _type in SKIN_COLUMNS:
                value = expected[column]
                if column in skin_missing:
                    if value is not None:
                        pending.append(("champion_skins", key, column, value))
                    continue
                if row is None or not _same(row[column], value):
                    pending.append(("champion_skins", key, column, value))

        recorded = database.execute("SELECT value FROM meta WHERE key = ?", (META_SNAPSHOT_KEY,)).fetchone()
        meta_stale = recorded is None or recorded[0] != digest

        if not added and not pending and not meta_stale:
            return report

        # ---- 写入 ----
        column_types = {
            **{f"champions.{column}": column_type for column, column_type in CHAMPION_COLUMNS},
            **{f"champion_skins.{column}": column_type for column, column_type in SKIN_COLUMNS},
        }
        for table in ("champions", "champion_skins"):
            for column in missing if table == "champions" else skin_missing:
                database.execute(
                    f"ALTER TABLE {table} ADD COLUMN {column} {column_types[f'{table}.{column}']}"
                )
        report.added_columns = added

        champion_keys: set[str] = set()
        skin_keys: set[tuple[str, int]] = set()
        for table, key, column, value in pending:
            if table == "champions":
                database.execute(f"UPDATE champions SET {column} = ? WHERE key = ?", (value, key))
                champion_keys.add(key)
            else:
                database.execute(
                    f"UPDATE champion_skins SET {column} = ? WHERE champion_key = ? AND num = ?",
                    (value, key[0], key[1]),
                )
                skin_keys.add(key)
        report.updated_rows = len(champion_keys | {f"{k[0]}#{k[1]}" for k in skin_keys})
        for _table, _key, column, _value in pending:
            report.updated_columns[column] = report.updated_columns.get(column, 0) + 1

        database.execute(
            "INSERT INTO meta (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (META_SNAPSHOT_KEY, digest),
        )
        database.commit()
        report.wrote = True

    # 写完再验一遍：本命令的产出必须是"验得过的"
    report.drift = verify_release_database(database_path, snapshot_path).drift
    return report

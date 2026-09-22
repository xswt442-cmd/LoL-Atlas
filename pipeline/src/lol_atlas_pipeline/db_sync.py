"""把发布快照里「补丁脚本新增的字段」同步进已发布的 sqlite 库。

## 为什么不是「从 lol.json 重建库」

库里有**快照不携带**的列，从快照重建会静默丢掉它们：技能各级冷却 / 消耗 / 射程
（`champion_spells.cooldown_levels` / `cost_levels` / `range_levels`，各 692 行）和技能图
（`image`，865 行）。这些来自造库那一步的原始抓取数据，不在 `lol.json` 里。
所以这里只做**增量同步**：库的其余内容原样不动。

## 同步哪些列

`lib/` 那两个补丁脚本（`enrich-champion-stats.mjs`、`enrich-champion-fields.mjs`）往快照里加的字段：

    attackdamage_per_level   库里是 0（ddragon 对该字段全量为 0，见补数据脚本）
    attackspeed_ratio        库缺列
    crit_damage              库缺列
    pathing_radius           库缺列
    selection_radius         库缺列
    selection_height         库缺列
    acquisition_range        库缺列（12 个英雄没有，留 NULL）
    blurb_en                 库缺列
    initial                  库缺列

**皮肤表的 `chromas` 不在同步范围**：库把炫彩也存成独立行、按行数计数，快照的
`chroma_count` 来自 ddragon 的 parentSkin 关系，两者在 935 条上口径不同。那是两个产物的
语义差异，得先定哪个口径为准，不能由本命令悄悄改写。
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from dataclasses import dataclass, field
from pathlib import Path

# 列名 → (sqlite 类型, 是否允许缺失)。缺失时留 NULL，不写 0 —— 写 0 会被读成"真的是 0"
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


def _expected_columns(champion: dict) -> dict[str, object]:
    return {column: champion.get(column) for column, _ in CHAMPION_COLUMNS}


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


def _missing_columns(database: sqlite3.Connection) -> list[str]:
    present = {row[1] for row in database.execute("PRAGMA table_info(champions)")}
    return [column for column, _ in CHAMPION_COLUMNS if column not in present]


def verify_release_database(database_path: Path, snapshot_path: Path) -> SyncReport:
    """只比较不写入：逐列核对，返回不一致项。"""
    data = _load_snapshot(snapshot_path)
    report = SyncReport()
    with closing(sqlite3.connect(database_path)) as database:
        _check_versions(database, data, database_path)
        missing = _missing_columns(database)
        report.added_columns = list(missing)
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
                    report.drift.append(f"{champion['id']}.{column}: 库 {row[column]!r} vs 快照 {champion.get(column)!r}")
        recorded = database.execute("SELECT value FROM meta WHERE key = ?", (META_SNAPSHOT_KEY,)).fetchone()
        if recorded is None or recorded[0] != _snapshot_sha256(snapshot_path):
            report.drift.append(f"meta.{META_SNAPSHOT_KEY} 与当前快照不符")
    return report


def sync_release_database(database_path: Path, snapshot_path: Path) -> SyncReport:
    """把快照里的补丁字段写进库。没有变化就完全不碰文件（保证可重复执行、sha256 稳定）。"""
    data = _load_snapshot(snapshot_path)
    report = SyncReport()
    digest = _snapshot_sha256(snapshot_path)

    with closing(sqlite3.connect(database_path)) as database:
        _check_versions(database, data, database_path)
        missing = _missing_columns(database)
        existing = [column for column, _ in CHAMPION_COLUMNS if column not in missing]

        # 先算出要改什么，再决定要不要写 —— 空跑一次不能动到文件
        selected = ", ".join(existing) if existing else "key"
        stored = {
            row[0]: dict(zip(existing, row[1:]))
            for row in database.execute(f"SELECT key, {selected} FROM champions")
        }
        pending: list[tuple[str, str, object]] = []
        for champion in data["champions"]:
            row = stored.get(champion["key"])
            for column, _type in CHAMPION_COLUMNS:
                expected = champion.get(column)
                if column in missing:
                    # 新列：只要快照有值就写（没有就留 NULL）
                    if expected is not None:
                        pending.append((champion["key"], column, expected))
                    continue
                if row is None or not _same(row[column], expected):
                    pending.append((champion["key"], column, expected))

        recorded = database.execute("SELECT value FROM meta WHERE key = ?", (META_SNAPSHOT_KEY,)).fetchone()
        meta_stale = recorded is None or recorded[0] != digest

        if not missing and not pending and not meta_stale:
            return report

        types = dict(CHAMPION_COLUMNS)
        for column in missing:
            database.execute(f"ALTER TABLE champions ADD COLUMN {column} {types[column]}")
        report.added_columns = list(missing)

        for key, column, value in pending:
            database.execute(f"UPDATE champions SET {column} = ? WHERE key = ?", (value, key))
            report.updated_columns[column] = report.updated_columns.get(column, 0) + 1
        report.updated_rows = len({key for key, _column, _value in pending})

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

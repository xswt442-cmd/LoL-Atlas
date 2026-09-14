"""Normalization rules applied only after the retained item graph is final."""

from __future__ import annotations

import sqlite3
from pathlib import Path


def item_tier(has_components: bool, has_upgrades: bool) -> str:
    if not has_components:
        return "基础件" if has_upgrades else "独立"
    return "史诗" if has_upgrades else "成品"


def normalize_sqlite_item_tiers(database: Path) -> int:
    connection = sqlite3.connect(database)
    try:
        rows = connection.execute(
            """
            SELECT items.id, items.tier,
                   EXISTS(SELECT 1 FROM item_builds WHERE item_id = items.id),
                   EXISTS(SELECT 1 FROM item_builds WHERE component_id = items.id)
            FROM items
            """
        ).fetchall()
        updates = [
            (item_tier(bool(has_components), bool(has_upgrades)), item_id)
            for item_id, tier, has_components, has_upgrades in rows
            if tier != item_tier(bool(has_components), bool(has_upgrades))
        ]
        with connection:
            connection.executemany("UPDATE items SET tier = ? WHERE id = ?", updates)
        return len(updates)
    finally:
        connection.close()

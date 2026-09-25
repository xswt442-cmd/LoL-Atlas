"""从公开数据源构建完整快照。

## 数据源与产出

| 段 | 来源 |
| --- | --- |
| champions | ddragon zh_CN/en_US championFull + CD v1 champions（玩法五维/定位/战术信息）+ CD characters（成长值/攻速比率/暴击伤害/单位几何）+ data/champion-initials.json |
| items | ddragon zh_CN item（集合沿用上一版快照，新增/移除进报告） |
| trees/runes | ddragon runesReforged zh_CN（文本）+ en_US（key） |
| stat_mods | CD perkstyles 的 kStatMod 槽位 |
| summoner | ddragon zh_CN summoner（同名留小 key） |
| timeline | 继承上一版 + 自动数值 diff 追加新版本条目 |
| wiki | 上一版原样继承（英文原案不随补丁变化；新英雄没有，UI 已容忍） |

## 技能文本的门控（本模块最重要的一条规则）

快照里的技能描述是**腾讯源的增强文本**（数值以【】标出，如
`造成(【60/90/120/150/180】+90%【额外攻击力】)物理伤害`），该来源 16.19 起已不可
程序化获取（gtimg 的 description 字段空化）。因此构建器对每个技能做门控：

- ddragon 旧版文本 == 新版文本（技能没被改动）→ **继承上一版快照**的增强文本；
- 文本变了 → 回退到 ddragon zh_CN 文本（`source: "ddragon"`，无数值标注），并在
  报告里列出 —— 这些技能需要人工核对数值后补回增强文本。

回退是显式且可见的，绝不静默丢掉数值标注。

## 已知边界

- 物品 `categories` 无法从公开源推导，按 id 继承上一版；新物品留空待人工归类。
- 物品 `components` 的 qty 沿用上一版（ddragon 只有 from 列表，不含数量）。
- 新英雄：字段完整但 wiki 为空、`values` 缺失，报告中列出。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .sources import cd_version, load_sources

ROOT = Path(__file__).resolve().parents[3]

# ddragon zh_CN 属性名 → 快照字段名
STAT_FIELDS: tuple[tuple[str, str], ...] = (
    ("hp", "hp"), ("hpperlevel", "hp_per_level"),
    ("mp", "mp"), ("mpperlevel", "mp_per_level"),
    ("armor", "armor"), ("armorperlevel", "armor_per_level"),
    ("spellblock", "spellblock"), ("spellblockperlevel", "spellblock_per_level"),
    ("attackdamage", "attackdamage"), ("attackdamageperlevel", "attackdamage_per_level"),
    ("attackspeed", "attackspeed"), ("attackspeedperlevel", "attackspeed_per_level"),
    ("attackrange", "attackrange"),
    ("hpregen", "hpregen"), ("hpregenperlevel", "hpregen_per_level"),
    ("mpregen", "mpregen"), ("mpregenperlevel", "mpregen_per_level"),
    ("crit", "crit"), ("critperlevel", "crit_per_level"),
    ("movespeed", "movespeed"),
)

ATTACK_TYPE_ZH = {"melee": "近战", "ranged": "远程"}
DAMAGE_TYPE_ZH = {"kPhysical": "物理", "kMagic": "魔法", "kMixed": "混合"}

# CD championTagInfo 的英文定位 → 中文（值域从 16.19 全量反推，19 个 + 空）
# ddragon zh_CN 的英雄 tags 也是英文，中文需映射（6 个，全量覆盖）
CHAMPION_CLASS_ZH: dict[str, str] = {
    "Fighter": "战士", "Tank": "坦克", "Mage": "法师", "Assassin": "刺客",
    "Marksman": "射手", "Support": "辅助",
}

# 由 16.19 数据反推（173 个英雄零冲突）。新增定位标签时映射不到会落 None，验收 diff 会暴露
CHAMPION_TAG_ZH: dict[str, str] = {
    "Sustained Damage": "持续伤害",
    "Self Healing": "自我治疗",
    "Mobile": "机动",
    "Burst": "爆发",
    "Stealth": "潜行",
    "Crowd Control": "控制",
    "Initiator": "先手发起者",
    "Dive": "陷阵",
    "AoE": "群体效果",
    "Summon": "召唤",
    "Hypercarry": "大后期",
    "Auto-attack": "普攻",
    "Damage-over-Time": "周期伤害",
    "Durable": "耐久",
    "Duelist": "单挑",
    "Shapeshift": "变换形态",
    "Long Range": "远距离",
    "Battlecaster": "战斗法师",
    "Ally Protection": "友军保护",
    "": None
}

# 物品描述 <stats> 块的中文标签 → 属性列。百分比与固定值分列（如 移动速度）。
# 由 16.19 快照反推（220 件零冲突）
ITEM_TAG_ZH: dict[str, str] = {
    "Active": "主动",
    "Jungle": "打野",
    "Lane": "对线",
    "Trinket": "饰品",
    "Vision": "视野",
    "HealthRegen": "生命回复",
    "Consumable": "消耗品",
    "Stealth": "潜行",
    "ManaRegen": "法力回复",
    "AttackSpeed": "攻速",
    "CooldownReduction": "冷却缩减",
    "Boots": "鞋子",
    "Mana": "法力",
    "Armor": "护甲",
    "Damage": "攻击力",
    "Health": "生命",
    "SpellDamage": "法强",
    "SpellBlock": "魔抗",
    "SpellVamp": "法术吸血",
    "GoldPer": "金币",
    "LifeSteal": "生命偷取",
    "OnHit": "攻击特效",
    "NonbootsMovement": "移速",
    "Tenacity": "韧性",
    "CriticalStrike": "暴击",
    "AbilityHaste": "技能急速",
    "ArmorPenetration": "穿甲",
    "MagicPenetration": "法穿",
    "MagicResist": "魔抗",
    "Aura": "光环",
    "Slow": "减速"
}

# 属性标签 → 列：元组是 (无 % 时的列, 有 % 时的列)。移动速度与法术穿透
# 同时存在固定值和百分比两种形态，靠数值里有没有 % 选列
ITEM_STAT_COLUMNS: dict[str, tuple[str, str]] = {
    "生命值": ("hp", "hp"), "基础生命回复": ("hp_regen", "hp_regen"),
    "生命回复": ("hp_regen", "hp_regen"),
    "法力": ("mana", "mana"), "基础法力回复": ("mana_regen", "mana_regen"),
    "法力回复": ("mana_regen", "mana_regen"),
    "攻击力": ("ad", "ad"), "法术强度": ("ap", "ap"),
    "护甲": ("armor", "armor"), "魔法抗性": ("mr", "mr"),
    "攻击速度": ("attack_speed", "attack_speed"), "暴击几率": ("crit", "crit"),
    "暴击伤害": ("crit_damage", "crit_damage"), "技能急速": ("ability_haste", "ability_haste"),
    "穿甲": ("lethality", "lethality"), "护甲穿透": ("armor_pen_pct", "armor_pen_pct"),
    "法术穿透": ("magic_pen_flat", "magic_pen_pct"),
    "生命偷取": ("life_steal", "life_steal"), "全能吸血": ("omnivamp", "omnivamp"),
    "治疗和护盾强度": ("heal_shield_power", "heal_shield_power"),
    "金币/10秒": ("gold_per_10", "gold_per_10"), "韧性": ("tenacity", "tenacity"),
    "适应之力": ("adaptive_force", "adaptive_force"),
    "移动速度": ("move_speed_flat", "move_speed_pct"),
}

# <stats> 块没覆盖的列从 ddragon 的 stats 字段兜底（键 → 列；True 表示小数需 ×100）
ITEM_STATS_FALLBACK: dict[str, tuple[str, bool]] = {
    "FlatMovementSpeedMod": ("move_speed_flat", False),
    "PercentMovementSpeedMod": ("move_speed_pct", True),
    "FlatHPPoolMod": ("hp", False),
    "FlatHPRegenMod": ("hp_regen", False),
    "FlatMPRegenMod": ("mana_regen", False),
    "FlatArmorPenetrationMod": ("lethality", False),
    "FlatMagicPenetrationMod": ("magic_pen_flat", False),
    "FlatCritChanceMod": ("crit", True),
    "FlatAttackSpeedMod": ("attack_speed", True),
}


@dataclass
class BuildReport:
    """构建报告：需要人工注意的事项都列在这里。"""

    spell_fallbacks: list[str] = field(default_factory=list)
    new_champions: list[str] = field(default_factory=list)
    new_items: list[str] = field(default_factory=list)
    removed_items: list[str] = field(default_factory=list)
    new_skins: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def strip_tags(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text or "")).strip()


def strip_tags_keep_i(text: str) -> str:
    """中文简介的去标签：保留 `<i>`（官方文案用它的强调，快照历来保留）。"""
    kept = re.sub(r"<([^>]+)>", lambda m: m.group(0) if m.group(1).lower() in ("i", "/i") else "", text or "")
    return re.sub(r"\s+", " ", kept).strip()


def html_to_text(html: str) -> str:
    """ddragon 物品描述 → 纯文本：`<br>` 变空格，其余标签删除，空白压缩。"""
    spaced = re.sub(r"<br\s*/?>", " ", html or "")
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", spaced)).strip()


def _modifiable(record: dict, key: str):
    raw = record.get(key)
    if raw is None:
        return None
    if isinstance(raw, dict) and "baseValue" in raw:
        return raw["baseValue"]
    return raw if isinstance(raw, (int, float)) else None


def build_champions(sources: dict, version: str, previous: dict | None, report: BuildReport) -> list[dict]:
    zh = sources["ddragon"]["zh_CN/championFull"]["data"]
    en = sources["ddragon"]["en_US/championFull"]["data"]
    initials_path = ROOT / "data" / "champion-initials.json"
    initials = json.loads(initials_path.read_text(encoding="utf-8")) if initials_path.exists() else {}

    previous_champions = {}
    if previous:
        previous_champions = {c["id"]: c for c in previous["champions"]}
    previous_full = {}
    if previous:
        # 门控需要旧版 ddragon 文本：只取 zh_CN championFull 这一个文件
        from .sources import fetch_champion_full

        previous_full = fetch_champion_full(previous["meta"]["version"], "zh_CN")["data"]

    champions = []
    for champion_id in sorted(zh):
        entry = zh[champion_id]
        en_entry = en.get(champion_id, {})
        cd_v1 = sources["cd_champions"].get(champion_id, {})
        cd_char = sources["cd_characters"].get(champion_id, {})
        prev = previous_champions.get(champion_id)

        if prev is None:
            report.new_champions.append(champion_id)

        tactical = cd_v1.get("tacticalInfo", {})
        tags_info = cd_v1.get("championTagInfo", {})
        tag_primary = CHAMPION_TAG_ZH.get(tags_info.get("championTagPrimary"))
        tag_secondary = CHAMPION_TAG_ZH.get(tags_info.get("championTagSecondary"))

        champion = {
            "key": entry["key"],
            "id": champion_id,
            "name": entry["title"],       # ddragon zh_CN 的 name 是称号，title 才是真名
            "epithet": entry["name"],
            "name_en": champion_id,
            "initial": initials.get(entry["key"]),
            "blurb": strip_tags_keep_i(entry["blurb"]),
            "blurb_en": strip_tags(en_entry.get("blurb")),
            "partype": entry["partype"],
            "tags": json.dumps(en_entry.get("tags", [])),
            "tags_zh": [CHAMPION_CLASS_ZH.get(t, t) for t in entry.get("tags", [])],
            "roles": json.dumps([t.lower() for t in en_entry.get("tags", [])]),
            "tag_primary": tag_primary,
            "tag_secondary": tag_secondary,
            "attack_type": ATTACK_TYPE_ZH.get(tactical.get("attackType")),
            "damage_type": DAMAGE_TYPE_ZH.get(tactical.get("damageType")),
            "playstyle": cd_v1.get("playstyleInfo", {}),
            "attack": entry["info"]["attack"],
            "defense": entry["info"]["defense"],
            "magic": entry["info"]["magic"],
            "difficulty": entry["info"]["difficulty"],
            "icon": f"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{champion_id}.png",
            "skins": [],
            "spells": [],
        }
        for dd_name, snap_name in STAT_FIELDS:
            champion[snap_name] = entry["stats"].get(dd_name)

        # CommunityDragon：成长值与几何（ddragon 缺失或恒 0 的字段）
        champion["attackdamage_per_level"] = round(_modifiable(cd_char, "damagePerLevelModifiable") or 0, 2)
        for key, source_key, digits in (
            ("attackspeed_ratio", "attackSpeedRatioModifiable", 4),
            ("crit_damage", "critDamageMultiplier", 3),
            ("pathing_radius", "pathfindingCollisionRadius", 2),
            ("selection_radius", "selectionRadius", 2),
            ("selection_height", "selectionHeight", 2),
            ("acquisition_range", "acquisitionRange", 2),
        ):
            value = _modifiable(cd_char, source_key)
            if value is not None:
                champion[key] = round(value, digits)

        # 技能：文本门控 —— ddragon 文本没变就继承上一版的增强文本
        previous_spells = {s["slot"]: s for s in prev["spells"]} if prev else {}
        old_entry = previous_full.get(champion_id, {})
        old_spells = {s["id"][len(champion_id):].upper(): s for s in old_entry.get("spells", [])}
        old_passive = old_entry.get("passive", {})
        image_base = f"https://ddragon.leagueoflegends.com/cdn/{version}/img"

        passive = entry["passive"]
        spell = {
            "slot": "P", "name": passive["name"],
            "cooldown": None, "cost": None, "range_": None,
            "icon_url": f"{image_base}/passive/{passive['image']['full']}",
        }
        _gate_spell_text(spell, strip_tags(passive["description"]),
                         old_strip(old_passive.get("description")),
                         previous_spells.get("P"), report, champion_id, "P")
        champion["spells"].append(spell)

        for index, dd_spell in enumerate(entry["spells"]):
            slot = "QWER"[index]
            image_full = dd_spell["image"]["full"]
            spell = {
                "slot": slot, "name": dd_spell["name"],
                "cooldown": dd_spell.get("cooldownBurn"),
                "cost": dd_spell.get("costBurn"),
                "range_": dd_spell.get("rangeBurn"),
                "icon_url": f"{image_base}/spell/{image_full}",
            }
            _gate_spell_text(spell, strip_tags(dd_spell["description"]),
                             old_strip(old_spells.get(slot, {}).get("description")),
                             previous_spells.get(slot), report, champion_id, slot)
            champion["spells"].append(spell)

        # 皮肤：parentSkin 折叠成 chroma_count，按 num 排序
        for skin_entry in entry["skins"]:
            if skin_entry.get("parentSkin") is not None:
                continue
            count = sum(1 for s in entry["skins"] if s.get("parentSkin") == skin_entry["num"])
            champion["skins"].append({
                "num": skin_entry["num"], "name": "默认" if skin_entry["name"] == "default" else skin_entry["name"], "chroma_count": count,
            })
            if prev and not any(s["num"] == skin_entry["num"] for s in prev.get("skins", [])):
                report.new_skins.append(f"{champion_id}#{skin_entry['num']} {skin_entry['name']}")
        champion["skins"].sort(key=lambda s: s["num"])

        champions.append(champion)
    return champions


def old_strip(text: str | None) -> str:
    """旧版 ddragon 文本归一化：去标签、压空白 —— 与新版比较用。"""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text or "")).strip()


def _gate_spell_text(spell: dict, new_text: str, old_text: str | None, previous_spell: dict | None,
                     report: BuildReport, champion_id: str, slot: str) -> None:
    """技能文本门控：ddragon 文本未变 → 继承上一版增强文本；变了 → 回退 ddragon 并报告。"""
    inherited = previous_spell and old_text is not None and old_text == new_text
    if inherited:
        for field in ("description", "values", "source"):
            if field in previous_spell:
                spell[field] = previous_spell[field]
        return
    spell["description"] = new_text
    spell["values"] = re.findall(r"【([^】]*\d[^】]*)】", new_text)
    spell["source"] = "ddragon"
    report.spell_fallbacks.append(f"{champion_id} {slot}")


def item_tier(has_components: bool, has_upgrades: bool) -> str:
    if not has_components:
        return "基础件" if has_upgrades else "独立"
    return "史诗" if has_upgrades else "成品"


def parse_stats_block(source: dict) -> dict[str, float]:
    """物品属性列：`<stats>` 块为主（数值里的 % 后缀选列），stats 字段兜底，缺失补 0。

    ddragon 的 stats 字段是小数（0.25 = 25%），需 ×100 —— schema 注释里"它的百分比是
    小数"那条规则。哪些列走兜底是按 220 件现有物品反推的。
    """
    values: dict[str, float] = {column: 0 for columns in ITEM_STAT_COLUMNS.values() for column in columns}
    html = source.get("description") or ""
    block = re.search(r"<stats>(.*?)</stats>", html, re.S)
    if block:
        for match in re.finditer(r"<attention>([^<]+)</attention>([^<]*)", block.group(1)):
            number = float(re.sub(r"[^\d.]", "", match.group(1)) or 0)
            label = match.group(2).strip()
            columns = ITEM_STAT_COLUMNS.get(label)
            if not columns:
                continue
            is_percent = "%" in match.group(1)
            column = columns[1] if is_percent else columns[0]
            values[column] = max(number, values.get(column, 0))
    for key, (column, as_percent) in ITEM_STATS_FALLBACK.items():
        if values.get(column):
            continue
        raw = (source.get("stats") or {}).get(key)
        if isinstance(raw, (int, float)):
            values[column] = round(raw * (100 if as_percent else 1), 2)
    return values


def build_items(sources: dict, version: str, previous: dict | None, report: BuildReport) -> list[dict]:
    zh_items = sources["ddragon"]["zh_CN/item"]["data"]
    previous_items = {i["id"]: i for i in previous["items"]} if previous else {}
    items = []

    for item_id, source in sorted(zh_items.items(), key=lambda pair: int(pair[0])):
        prev = previous_items.get(item_id)
        # 源数据空化（描述与属性全空，如 16.19.1 的异世珍藏）：沿用上一版，不产生假"归零"
        if prev is not None and not source.get("description") and not source.get("stats"):
            items.append(prev)
            report.notes.append(f"物品 {item_id} {prev['name']} 在 {version} 的 ddragon 数据为空，沿用上一版")
            continue
        if prev is None and previous is not None:
            # 上一版没有的物品：只收录在售的峡谷装备，categories 留空待人工归类
            if not (str(source["maps"].get("11")) == "True" and source["gold"]["purchasable"]):
                continue
            report.new_items.append(f"{item_id} {source['name']}")

        icon_full = source["image"]["full"]
        components = prev.get("components", []) if prev else []
        builds_into = prev.get("builds_into", []) if prev else []
        item = {
            "id": item_id,
            "name": source["name"],
            "plaintext": source.get("plaintext") or None,
            "description_html": source["description"],
            "description": html_to_text(source["description"]),
            "tags": source.get("tags", []),
            "tags_zh": [ITEM_TAG_ZH.get(t, t) for t in source.get("tags", [])],
            "tier": item_tier(bool(source.get("from")), bool(source.get("into"))),
            "maps": json.dumps(source.get("maps", {})),
            "available_sr": 1 if str(source["maps"].get("11")) == "True" else 0,
            "gold_base": source["gold"]["base"],
            "gold_total": source["gold"]["total"],
            "gold_sell": source["gold"]["sell"],
            "purchasable": 1 if source["gold"]["purchasable"] else 0,
            "stats_json": json.dumps(source.get("stats", {})),
            "icon": f"https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{icon_full}",
            "components": components,
            "builds_into": builds_into,
        }
        parsed_stats = parse_stats_block(source)
        # 描述里没有 <stats> 块时继承上一版的属性列：源数据把数值挪走 ≠ 属性真的消失
        block_present = "<stats>" in (source.get("description") or "")
        if not block_present and prev:
            for column in set(parsed_stats) | {k for k in prev if isinstance(prev.get(k), (int, float)) and k in parsed_stats}:
                pass
            for column in parsed_stats:
                if parsed_stats[column] == 0 and prev.get(column):
                    parsed_stats[column] = prev[column]
        item.update(parsed_stats)
        # 合成关系继承上一版（ddragon 不提供 qty）
        if prev is None and source.get("from"):
            item["components"] = [{"id": component, "qty": 1} for component in source["from"]]
            report.notes.append(f"新物品 {item_id} {source['name']} 的 components 数量按 1 处理，需人工核对")
        for field in ("categories",):
            if prev and field in prev:
                item[field] = prev[field]
        items.append(item)

    if previous:
        for item_id in sorted(set(previous_items) - {i["id"] for i in items}):
            report.removed_items.append(f"{item_id} {previous_items[item_id]['name']}")
    return items


def build_runes(sources: dict, version: str) -> list[dict]:
    """符文树：en_US 为骨架（顺序/key/图标），zh_CN 按 (槽位序, 符文序) 配对提供中文。

    不能用符文 id 在两份数据间配对 —— zh_CN 的树序与 en_US 不同，且部分条目的
    name/icon 相互错位（精密的树挂过主宰的图标）；同补丁的本地化按位置是一一对应的。
    树的 `key` 与图标取自 en_US；快照里的符文 `key`（如 PressTheAttack）来自
    CD perks.json 的 id —— 图标文件名会骗人（LethalTempo 的目录叫 LethalTempoTemp）。
    """
    cd_id_by_name = {
        perk["name"]: perk["id"]
        for perk in sources["cd_perks"]
        if isinstance(perk, dict) and "name" in perk and "id" in perk
    }
    zh_trees = {index: tree for index, tree in enumerate(sources["ddragon"]["zh_CN/runesReforged"])}
    en_trees = sorted(enumerate(sources["ddragon"]["en_US/runesReforged"]), key=lambda pair: pair[1]["id"])
    trees = []
    for en_index, en_tree in en_trees:
        zh_tree = zh_trees.get(en_index, {})
        zh_slots = zh_tree.get("slots", [])
        built = {
            "id": en_tree["id"], "key": en_tree["key"],
            "name": zh_tree.get("name", en_tree["name"]), "icon": en_tree["icon"], "slots": [],
        }
        for slot_index, slot in enumerate(en_tree["slots"]):
            zh_slot = zh_slots[slot_index] if slot_index < len(zh_slots) else {"runes": []}
            runes = []
            for rune_index, rune in enumerate(slot["runes"]):
                zh_rune = zh_slot["runes"][rune_index] if rune_index < len(zh_slot.get("runes", [])) else {}
                icon_stem = rune["icon"].split("/")[-1].rsplit(".", 1)[0]
                # LethalTempo 的图标目录是 LethalTempoTemp（Riot 历史遗留），去尾缀对齐快照口径
                key = re.sub(r"Temp$", "", icon_stem) if icon_stem.endswith("Temp") else icon_stem
                runes.append({
                    "id": rune["id"], "key": key,
                    "name": zh_rune.get("name", rune["name"]),
                    "short_desc": strip_tags(zh_rune.get("shortDesc") or rune.get("shortDesc")),
                    "long_desc": strip_tags(zh_rune.get("longDesc") or rune.get("longDesc")),
                    "icon": rune["icon"],
                    "icon_url": f"https://ddragon.leagueoflegends.com/cdn/img/{rune['icon']}",
                    "desc_source": "ddragon",
                })
            built["slots"].append(runes)
        trees.append(built)
    return trees


def build_stat_mods(sources: dict, previous: dict | None, report: BuildReport) -> list[dict]:
    """属性碎片：perkstyles 的 kStatMod 槽位给出每行的 id 列表，明细在 perks.json。

    五个符文系的碎片配置一致，按 (id, row_no) 去重 —— 同一碎片可出现在多行（适应之力
    在进攻与灵活两行都有），这正是快照主键用 (id, row_no) 的原因。
    """
    label_rows = {"Offense": 1, "Flex": 2, "Defense": 3}
    # 上一版没有的碎片的英文名兜底
    name_zh_en: dict[int, str] = {}
    previous_mods = {(m["id"], m["row_no"]): m for m in previous["stat_mods"]} if previous else {}
    perks_by_id = {
        perk["id"]: perk
        for perk in sources["cd_perks"]
        if isinstance(perk, dict) and "id" in perk
    }
    mods: dict[tuple[int, int], dict] = {}
    for style in sources["cd_perkstyles"]["styles"]:
        for slot in style["slots"]:
            if slot.get("type") != "kStatMod":
                continue
            row_no = label_rows.get(slot.get("slotLabel"))
            if row_no is None:
                continue
            for position, perk_id in enumerate(slot.get("perks", []), start=1):
                perk = perks_by_id.get(perk_id, {})
                inherited = previous_mods.get((perk_id, row_no))
                mods[(perk_id, row_no)] = {
                    "id": perk_id, "row_no": row_no, "position": position,
                    "name": (inherited or {}).get("name") or perk.get("name"),
                    "stat": (inherited or {}).get("stat") or strip_tags(perk.get("longDesc") or perk.get("shortDesc")),
                    # perks.json 的 iconPath 是客户端绝对路径（/lol-game-data/assets/v1/...），需要归一化
                    "icon_url": "https://ddragon.leagueoflegends.com/cdn/img/"
                                + re.sub(r"^/?(?:lol-game-data/assets/v1/)?", "", perk.get("iconPath") or ""),
                }
    # 按 (行, 位置) 排序 —— 与快照的展示顺序一致
    return [mods[key] for key in sorted(mods, key=lambda k: (k[1], mods[k]["position"]))]


def build_summoner(sources: dict, version: str, previous: dict | None, report: BuildReport) -> list[dict]:
    """召唤师技能：集合继承上一版（9 个标准峡谷召唤师技能），按 id 刷新字段。

    ddragon 的全集有 22 个（含乱斗/限时模式专属），当年的筛选规则已不可考；
    集合以快照为准是最稳的。新增的召唤师技能（Riot 多年没加过）会进报告。
    """
    zh = sources["ddragon"]["zh_CN/summoner"]["data"]
    kept_ids = [s["id"] for s in previous["summoner"]] if previous else []
    by_id = {}
    for entry in zh.values():
        by_id.setdefault(entry["id"], []).append(entry)

    spells = []
    for spell_id in kept_ids:
        entries = by_id.get(spell_id)
        if not entries:
            report.removed_items.append(f"召唤师技能 {spell_id} 在 {version} 的 ddragon 中不存在")
            continue
        # 同名重复（「屏障」有 key=21 与 721 两个变体）：key 数字小的优先
        entry = min(entries, key=lambda e: int(e["key"]))
        spells.append({
            "id": entry["id"], "key": entry["key"], "name": entry["name"],
            "description": strip_tags(entry.get("description")),
            "level": entry.get("summonerLevel"),
            "cooldown": entry.get("cooldownBurn"),
            "icon": f"https://ddragon.leagueoflegends.com/cdn/{version}/img/spell/{entry['image']['full']}",
        })
    return spells


def diff_timeline(previous: dict, built: dict, version: str) -> dict:
    """对上一版做数值 diff，生成 {v: 版本, c: {字段: [旧, 新]}} 条目追加进 timeline。

    只比较数字字段（校验器要求 timeline 的值对必须是有限数字）；文本与结构变化不进 timeline。
    """
    timeline = json.loads(json.dumps(previous["timeline"], ensure_ascii=False))
    if version not in timeline["versions"]:
        timeline["versions"].append(version)

    old_champions = {c["key"]: c for c in previous["champions"]}
    numeric = lambda obj: {k: v for k, v in obj.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    for champion in built["champions"]:
        old = old_champions.get(champion["key"])
        if not old:
            continue
        changes = {}
        old_numbers, new_numbers = numeric(old), numeric(champion)
        for field, value in new_numbers.items():
            old_value = old_numbers.get(field)
            if old_value is not None and abs(value - old_value) > 1e-9:
                changes[field] = [old_value, value]
        if changes:
            timeline["champions"].setdefault(champion["key"], []).append({"v": version, "c": changes})

    old_items = {i["id"]: i for i in previous["items"]}
    for item in built["items"]:
        old = old_items.get(item["id"])
        if not old:
            continue
        changes = {}
        old_numbers, new_numbers = numeric(old), numeric(item)
        for field, value in new_numbers.items():
            old_value = old_numbers.get(field)
            if old_value is not None and abs(value - old_value) > 1e-9:
                changes[field] = [old_value, value]
        if changes:
            timeline["items"].setdefault(item["id"], []).append({"v": version, "c": changes})
    return timeline


def build_snapshot(version: str, previous_path: Path | None) -> tuple[dict, BuildReport]:
    """构建一份完整快照。previous 为上一版快照（技能文本/wiki/timeline/categories 的来源）。"""
    previous = None
    if previous_path is not None:
        previous = json.loads(Path(previous_path).read_text(encoding="utf-8"))
        if previous["meta"]["version"] == version:
            raise ValueError("上一版快照与目标版本相同，没有可构建的差异")
    sources = load_sources(version)
    report = BuildReport()

    champions = build_champions(sources, version, previous, report)
    items = build_items(sources, version, previous, report)
    trees = build_runes(sources, version)
    stat_mods = build_stat_mods(sources, previous, report)
    summoner = build_summoner(sources, version, previous, report)

    snapshot = {
        "meta": {
            "version": version,
            "tx_version": cd_version(version),
            "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            "source": "Data Dragon zh_CN + CommunityDragon（成长值/几何/定位）"
                      " + 腾讯官方 CDN（技能数值，继承自上一版快照）",
            "counts": {
                "champions": len(champions),
                "spells": sum(len(c["spells"]) for c in champions),
                "items": len(items),
                "runes": sum(len(slot) for tree in trees for slot in tree["slots"]),
                "statMods": len(stat_mods),
                "summonerSpells": len(summoner),
            },
        },
        "champions": champions,
        "items": items,
        "trees": trees,
        "stat_mods": stat_mods,
        "summoner": summoner,
        "wiki": (previous or {}).get("wiki", {}),
    }
    if previous:
        snapshot["timeline"] = diff_timeline(previous, snapshot, version)
    return snapshot, report


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(prog="lol-atlas-build-snapshot")
    parser.add_argument("version", help="目标补丁版本，如 16.19.1")
    parser.add_argument("--previous", type=Path, default=None, help="上一版快照路径（缺省 = 从零构建，技能文本回退 ddragon）")
    parser.add_argument("--out", type=Path, default=None, help="输出目录（默认 data/releases/<版本>）")
    args = parser.parse_args()

    snapshot, report = build_snapshot(args.version, args.previous)
    out_dir = args.out or (ROOT / "data" / "releases" / args.version)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "lol.json").write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")

    if report.new_champions:
        print("新英雄:", ", ".join(report.new_champions))
    if report.spell_fallbacks:
        print(f"⚠ {len(report.spell_fallbacks)} 个技能文本回退到 ddragon（腾讯源已不可得），需人工补数值：")
        for line in report.spell_fallbacks:
            print("   ", line)
    if report.new_items:
        print("新物品:", "; ".join(report.new_items), "（categories 待人工归类）")
    if report.removed_items:
        print("已移除物品:", "; ".join(report.removed_items))
    if report.new_skins:
        print(f"新皮肤 {len(report.new_skins)} 个")
    for note in report.notes:
        print("  ", note)
    print(f"已写出 {out_dir / 'lol.json'}")


if __name__ == "__main__":
    main()

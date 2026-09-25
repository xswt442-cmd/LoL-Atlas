"""快照构建的取数层：带磁盘缓存的源数据加载。

缓存落在 `data/cache/snapshot-<版本>/`。重新构建同一版本时不再走网络；
换版本时自动重新抓取。所有请求带自定义 UA（CommunityDragon 会拒绝默认 UA）。
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CACHE_ROOT = ROOT / "data" / "cache"
USER_AGENT = {"user-agent": "lol-atlas-snapshot-builder/1.0 (+https://lol-atlas.xswt.fyi)"}


def _cache_path(version: str, name: str) -> Path:
    directory = CACHE_ROOT / f"snapshot-{version}"
    directory.mkdir(parents=True, exist_ok=True)
    return directory / name


def load_cached(version: str, name: str):
    path = _cache_path(version, name)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def fetch_json(version: str, name: str, url: str):
    """取一个源 JSON：有缓存用缓存，没有就抓取并落盘。"""
    cached = load_cached(version, name)
    if cached is not None:
        return cached
    request = urllib.request.Request(url, headers=USER_AGENT)
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read())
    _cache_path(version, name).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def champion_alias(champion_id: str) -> str:
    """英雄 id → CommunityDragon 的目录名（小写、去符号：Kha'Zix → khazix）。"""
    import re

    return re.sub(r"[^a-z0-9]", "", champion_id.lower())


def cd_version(data_version: str) -> str:
    """CommunityDragon 的版本目录是 major.minor（16.18.1 → 16.18），16.18.1 会 404。"""
    major, minor = data_version.split(".")[:2]
    return f"{major}.{minor}"


def fetch_champion_full(version: str, locale: str = "zh_CN") -> dict:
    """只要一个英雄全量文件（技能文本门控用旧版对比，不必拉整套源）。"""
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/{locale}/championFull.json"
    return fetch_json(version, f"ddragon-{locale}-championFull.json", url)


def load_sources(version: str) -> dict:
    """加载构建一份快照所需的全部源数据（含逐英雄的 CommunityDragon 数据）。

    173 个英雄的 CD 文件约 350 次请求、10 MB，全部走磁盘缓存 —— 只有首个版本会慢。
    英雄名单以 ddragon zh_CN championFull 为准。
    """
    sources: dict = {"ddragon": {}, "cd_champions": {}, "cd_characters": {}}
    for locale in ("zh_CN", "en_US"):
        for name in ("championFull", "item", "runesReforged", "summoner"):
            url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/{locale}/{name}.json"
            sources["ddragon"][f"{locale}/{name}"] = fetch_json(
                version, f"ddragon-{locale}-{name}.json", url
            )

    cd = cd_version(version)
    perkstyles_url = (
        "https://raw.communitydragon.org/"
        f"{cd}/plugins/rcp-be-lol-game-data/global/default/v1/perkstyles.json"
    )
    sources["cd_perkstyles"] = fetch_json(version, "cd-perkstyles.json", perkstyles_url)

    perks_url = (
        "https://raw.communitydragon.org/"
        f"{cd}/plugins/rcp-be-lol-game-data/global/default/v1/perks.json"
    )
    sources["cd_perks"] = fetch_json(version, "cd-perks.json", perks_url)

    roster = sources["ddragon"]["zh_CN/championFull"]["data"]
    for champion_id, entry in roster.items():
        alias = champion_alias(champion_id)
        v1_url = (
            "https://raw.communitydragon.org/"
            f"{cd}/plugins/rcp-be-lol-game-data/global/default/v1/champions/{entry['key']}.json"
        )
        bin_url = f"https://raw.communitydragon.org/{cd}/game/data/characters/{alias}/{alias}.bin.json"
        try:
            sources["cd_champions"][champion_id] = fetch_json(
                version, f"cd-champion-{champion_id}.json", v1_url
            )
            payload = fetch_json(version, f"cd-character-{champion_id}.json", bin_url)
            root_key = next(k for k in payload if k.lower().endswith("characterrecords/root"))
            sources["cd_characters"][champion_id] = payload[root_key]
        except Exception as error:  # noqa: BLE001 —— 单个英雄失败必须让整次构建失败
            raise RuntimeError(f"拉取 {champion_id} 的 CommunityDragon 数据失败: {error}") from error

    sources["roster"] = roster
    return sources

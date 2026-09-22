-- LOL 静态图鉴库 · 中文
-- 由造库脚本执行（历史上是 scripts/build_db.py，不在本仓库）。版本信息在 meta 表。
--
-- ⚠ 这个库不是「lol.json 的关系型镜像」，两边各有对方没有的东西：
--   · 库独有的：技能各级冷却 / 消耗 / 射程（cooldown_levels / cost_levels / range_levels）
--     与技能图（image），来自造库那一步的原始抓取数据，快照里没有。
--   · 快照独有的：补丁脚本（scripts/enrich-champion-*.mjs）后加的字段。
-- 所以补丁字段用 `lol-atlas-data sync-db <db> public/data/lol.json` **增量同步**进来，
-- 而不是从快照重建整个库（重建会静默丢掉上面那批列）。

PRAGMA journal_mode = WAL;

DROP TABLE IF EXISTS meta;
DROP TABLE IF EXISTS champion_skins;
-- 召唤师技能（闪现 / 点燃 / 传送…）。ddragon 的 summoner.json 里有重复条目：
-- 「屏障」同时存在 key=21 和 key=721（后者是「召唤师的决断」变体），「净化」有 1 和 71。
-- 建库时同名只留 key 数字小的那个，与装备的去重判据保持一致。
CREATE TABLE summoner_spells (
    id            TEXT PRIMARY KEY,   -- SummonerFlash
    key           TEXT,               -- "4"，游戏内数字 id
    name          TEXT,               -- 闪现
    description   TEXT,
    level         INTEGER,            -- 解锁所需的召唤师等级
    cooldown      TEXT,               -- cooldownBurn，字符串
    modes         TEXT,               -- JSON，如 ["ARAM","CLASSIC"]
    available_sr  INTEGER,            -- 1 = 峡谷可用（modes 含 CLASSIC）
    icon          TEXT
);

DROP TABLE IF EXISTS champion_spells;
DROP TABLE IF EXISTS champions;
DROP TABLE IF EXISTS item_builds;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS runes;
DROP TABLE IF EXISTS rune_trees;
DROP TABLE IF EXISTS stat_mods;

CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- 英雄。注意：ddragon 中文包的 name/title 与英文语义相反，
-- name 装的是称号（暗裔剑魔），title 装的是真名（亚托克斯）。
-- 这里已按语义重映射：name = 真名，epithet = 称号。
CREATE TABLE champions (
    key                    TEXT PRIMARY KEY,   -- "266"
    id                     TEXT NOT NULL,      -- "Aatrox"
    name                   TEXT NOT NULL,      -- 亚托克斯
    epithet                TEXT,               -- 暗裔剑魔
    name_en                TEXT,               -- Aatrox
    initial                TEXT,               -- 中文名拼音首字母，供字母索引分组
    blurb                  TEXT,
    blurb_en               TEXT,               -- 英文简介（ddragon en_US），中文 blurb 的对照
    partype                TEXT,               -- 资源类型：法力/怒气/鲜血魔井...
    tags                   TEXT,               -- JSON ["Fighter"]，英文原始
    tags_zh                TEXT,               -- JSON ["战士"]，便于中文查询
    roles                  TEXT,               -- JSON，来自 CommunityDragon
    tag_primary            TEXT,               -- 玩法定位（主要），CD championTagInfo
    tag_secondary          TEXT,               -- 玩法定位（次要），可能为空
    attack_type            TEXT,               -- 近战 / 远程（CD tacticalInfo.attackType）
    damage_type            TEXT,               -- 物理 / 魔法 / 混合（CD tacticalInfo.damageType）
    playstyle              TEXT,               -- JSON 五维：damage/durability/crowdControl/mobility/utility
    attack                 INTEGER,
    defense                INTEGER,
    magic                  INTEGER,
    difficulty             INTEGER,
    hp                     REAL,  hp_per_level                 REAL,
    mp                     REAL,  mp_per_level                 REAL,
    armor                  REAL,  armor_per_level              REAL,
    spellblock             REAL,  spellblock_per_level         REAL,
    attackdamage           REAL,  attackdamage_per_level       REAL,
    attackspeed            REAL,  attackspeed_per_level        REAL,
    attackrange            REAL,
    hpregen                REAL,  hpregen_per_level            REAL,
    mpregen                REAL,  mpregen_per_level            REAL,
    crit                   REAL,  crit_per_level               REAL,
    movespeed              REAL,
    -- 以下字段来自 CommunityDragon（ddragon 没有或恒为 0）：
    -- attackdamage_per_level 在 ddragon 里对全部英雄都是 0，必须由补数据脚本写入
    attackspeed_ratio      REAL,               -- 额外攻速的缩放基准；0 = 不走常规缩放（烬）
    crit_damage            REAL,               -- 暴击伤害倍率，2 = 200%；艾希是 1
    pathing_radius         REAL,               -- 单位几何：碰撞半径
    selection_radius       REAL,               -- 选中半径
    selection_height       REAL,               -- 选中高度
    acquisition_range      REAL,               -- 获取范围；12 个英雄没有该字段，留 NULL
    icon                   TEXT
);

CREATE TABLE champion_spells (
    id               INTEGER PRIMARY KEY,
    champion_key     TEXT NOT NULL REFERENCES champions(key),
    slot             TEXT NOT NULL,          -- P / Q / W / E / R
    name             TEXT,
    description      TEXT,                   -- 去标签后的纯文本
    description_html TEXT,
    tooltip          TEXT,                   -- 含未解析占位符的原文，如 {{ qdamage }}
    maxrank          INTEGER,
    cooldown         TEXT,                   -- "14/12/10/8/6"
    cooldown_levels  TEXT,                   -- JSON [14,12,10,8,6]，来自 CommunityDragon
    cost             TEXT,
    cost_levels      TEXT,                   -- JSON
    range_burn       TEXT,
    range_levels     TEXT,                   -- JSON
    image            TEXT,
    source           TEXT,                   -- tx（含数值） / ddragon（兜底）
    values_json      TEXT,                   -- JSON 数组，从描述【】里提出来的数值
    icon_url         TEXT,
    UNIQUE (champion_key, slot)
);

CREATE TABLE champion_skins (
    id           INTEGER PRIMARY KEY,
    champion_key TEXT NOT NULL REFERENCES champions(key),
    skin_id      TEXT,
    num          INTEGER,
    name         TEXT,
    chromas      INTEGER DEFAULT 0,   -- ⚠ 布尔标志：这个皮肤**有没有**炫彩（ddragon chromas 字段）
    chroma_count INTEGER              -- 炫彩**数量**，来自快照（ddragon parentSkin 关系，
);                                   -- 与 CommunityDragon 逐条一致）。两者口径不同，别混用

CREATE TABLE items (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    plaintext        TEXT,                   -- 一行简介
    description      TEXT,                   -- 去标签纯文本
    description_html TEXT,
    tags             TEXT,                   -- JSON，英文原始 tag
    tags_zh          TEXT,                   -- JSON，中文 tag
    categories       TEXT,                   -- JSON 数组，功能分类（可多值）
    tier             TEXT,                   -- 基础件 / 史诗 / 成品 / 独立
    maps             TEXT,                   -- JSON，键为地图 id
    available_sr     INTEGER DEFAULT 0,      -- maps.11 == true
    gold_base        INTEGER,
    gold_total       INTEGER,
    gold_sell        INTEGER,
    purchasable      INTEGER DEFAULT 0,
    -- 常用属性拆列，方便直接查；完整属性在 stats_json
    ad               REAL DEFAULT 0,
    ap               REAL DEFAULT 0,
    hp               REAL DEFAULT 0,
    mana             REAL DEFAULT 0,
    armor            REAL DEFAULT 0,
    mr               REAL DEFAULT 0,
    attack_speed     REAL DEFAULT 0,
    crit             REAL DEFAULT 0,
    ability_haste    REAL DEFAULT 0,
    move_speed_flat  REAL DEFAULT 0,
    move_speed_pct   REAL DEFAULT 0,
    lethality        REAL DEFAULT 0,
    armor_pen_pct    REAL DEFAULT 0,
    magic_pen_flat   REAL DEFAULT 0,
    magic_pen_pct    REAL DEFAULT 0,
    life_steal       REAL DEFAULT 0,
    omnivamp         REAL DEFAULT 0,
    hp_regen         REAL DEFAULT 0,
    mana_regen       REAL DEFAULT 0,
    tenacity         REAL DEFAULT 0,
    heal_shield_power REAL DEFAULT 0,       -- 治疗和护盾强度 %
    gold_per_10      REAL DEFAULT 0,        -- 金币/10秒
    crit_damage      REAL DEFAULT 0,        -- 暴击伤害加成 %
    adaptive_force   REAL DEFAULT 0,        -- 适应之力
    stats_json       TEXT,                  -- raw 的 stats 字段原文（只有 12 种 key，不全）
    icon             TEXT
);

-- ⚠ 属性列的数据来源是 description 里的 <stats> 块，不是 stats 字段。
-- ddragon 的 stats 字段只覆盖 12 种 key（攻击力/法术强度/生命/法力/护甲/魔抗/
-- 攻速/暴击/移速/生命偷取/生命回复），它没有技能急速、穿甲、法穿、全能吸血、
-- 韧性、护盾强度、金币/10秒、暴击伤害。这些只出现在描述的 <stats> 块里：
--     <attention>20</attention>技能急速
-- build_db.py 的 parse_stats_block() 解析中文属性名，才是这些列的真实来源。
-- stats 字段只作兜底，且它的百分比是小数（0.25 = 25%），需 ×100。

-- 合成关系：一行 = 一件成品需要的一个组件
-- qty 不能省：智慧末刃要 2 把短剑、万世催化石要 2 个红水晶，
-- 只用 (item_id, component_id) 当主键会把重复组件压成 1 个。
CREATE TABLE item_builds (
    item_id      TEXT NOT NULL REFERENCES items(id),
    component_id TEXT NOT NULL,
    qty          INTEGER DEFAULT 1,
    PRIMARY KEY (item_id, component_id)
);

CREATE TABLE rune_trees (
    id   INTEGER PRIMARY KEY,
    key  TEXT,
    name TEXT,
    icon TEXT
);

CREATE TABLE runes (
    id         INTEGER PRIMARY KEY,   -- 8112
    key        TEXT,                  -- Electrocute
    name       TEXT,                  -- 电刑
    tree_id    INTEGER REFERENCES rune_trees(id),
    slot_index INTEGER,               -- 0 = 基石
    short_desc TEXT,
    long_desc  TEXT,
    icon       TEXT,                  -- ddragon 给的相对路径
    icon_url   TEXT,                  -- 拼好的完整 URL
    desc_source TEXT                  -- 描述取自哪个源：ddragon / cd
);

-- ⚠ 符文图标的 CDN 路径是**不带版本号**的：
--     https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/...
--   带上版本号（/cdn/16.18.1/img/...）会返回 403。这个坑和装备/英雄图标不一样，
--   后者必须带版本号。属性碎片图标同理。

-- 属性碎片（符文页底部三行：进攻 / 灵活 / 防御）。ddragon 的 runesReforged.json
-- 完全不提供，只能从 CommunityDragon 的 perkstyles.json 里 type == "kStatMod" 的
-- slot 取。5 个符文系的碎片配置完全一致。
--
-- ⚠ 主键是 (id, row_no) 而不是 id：同一个碎片可以出现在多行——「适应之力」在进攻行
-- 和灵活行都有，「成长生命值」在灵活行和防御行都有。只按 id 做主键会把后一行覆盖掉，
-- 丢掉「这个碎片还有别的行能选」这个信息。
CREATE TABLE stat_mods (
    id       INTEGER,               -- 5008
    name     TEXT,                  -- 适应之力
    row_no   INTEGER,               -- 1 进攻 / 2 灵活 / 3 防御
    position INTEGER,               -- 行内第几个
    stat     TEXT,                  -- 去标签后的属性描述，如「+9 适应之力」
    icon_url TEXT,
    PRIMARY KEY (id, row_no)
);

CREATE INDEX idx_spells_champion ON champion_spells (champion_key);
CREATE INDEX idx_items_sr        ON items (available_sr);
CREATE INDEX idx_builds_comp     ON item_builds (component_id);
CREATE INDEX idx_runes_tree      ON runes (tree_id);

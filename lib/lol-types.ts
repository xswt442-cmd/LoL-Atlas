/**
 * 图鉴的领域模型：所有实体的字段定义，以及由字段派生的常量。
 *
 * 这里只放类型与常量，不放取数逻辑 —— 取数在 `lib/lol-data.ts`。
 * 两者分开是因为大量组件只需要类型，不该因此依赖一个会发请求的模块。
 */

export interface Spell {
  slot: "P" | "Q" | "W" | "E" | "R";
  name: string;
  description: string;
  cooldown: string | null;
  cost: string | null;
  range_: string | null;
  icon_url: string | null;
}

export interface ChampionSkin {
  num: number;
  name: string;
  /**
   * 该皮肤自带的炫彩数量。
   *
   * 炫彩在上游数据里被当成独立皮肤塞进 skins，但 ddragon 上没有它们的原画，
   * 所以 `scripts/enrich-champion-fields.mjs` 会把炫彩条目剔掉、把数量归到父皮肤上。
   * 上游重新生成数据后若没重跑该脚本，这里会缺省，UI 按 0 处理。
   */
  chroma_count?: number;
}

/** 官方五维玩法评分（0-3），用于雷达图 */
export interface Playstyle {
  damage: number;
  durability: number;
  crowdControl: number;
  mobility: number;
  utility: number;
}

export interface Champion {
  key: string;
  id: string;
  name: string;
  name_en: string;
  /** 英文简介（ddragon en_US），中文 blurb 的对照 */
  blurb_en?: string;
  /** 中文名拼音首字母，用于索引按字母分组 */
  initial?: string;
  epithet: string;
  blurb: string;
  partype: string;
  tags_zh: string[];
  tag_primary: string | null;
  tag_secondary: string | null;
  attack_type: string | null;
  damage_type: string | null;
  /** 数据管道里存成了 JSON 字符串（如 `"[\"mage\"]"`），使用前需 JSON.parse */
  roles?: string;
  playstyle?: Playstyle;
  skins?: ChampionSkin[];
  /**
   * 1 级基础值 + 每级成长值。成长**不是线性**的，累计倍率见
   * `lib/champion-stats.mjs` 的 `growthFactor`（18 级 17、20 级 19.665）。
   *
   * 攻速成长（`attackspeed_per_level`）的单位是百分比，且要乘 `attackspeed_ratio` 而不是
   * 基础攻速；`attackspeed_ratio` 为 0 表示该英雄不走这套缩放（烬）。
   */
  hp: number;
  hp_per_level: number;
  mp: number;
  mp_per_level: number;
  hpregen: number;
  hpregen_per_level: number;
  mpregen: number;
  mpregen_per_level: number;
  armor: number;
  armor_per_level: number;
  spellblock: number;
  spellblock_per_level: number;
  attackdamage: number;
  /** 来自 CommunityDragon —— ddragon 在当前版本对全部英雄都把这个字段写成 0 */
  attackdamage_per_level: number;
  attackspeed: number;
  attackspeed_per_level: number;
  attackspeed_ratio: number;
  /** 暴击伤害倍率（2 = 200%）。艾希是 1：她的暴击不加伤害，改成强化减速 */
  crit_damage: number;
  crit: number;
  crit_per_level: number;
  attackrange: number;
  movespeed: number;
  /** 单位几何，来自 CommunityDragon。`acquisition_range` 有 12 个英雄没有该字段 */
  pathing_radius?: number;
  selection_radius?: number;
  selection_height?: number;
  acquisition_range?: number;
  icon: string;
  spells: Spell[];
}

/**
 * 装备属性字段 → 中文标签。
 *
 * `ItemStatKey` 由它派生、`Item` 又是 `Record<ItemStatKey, number>`，所以新增一项属性
 * 只要改这里：类型、装备详情、配装汇总三处会一起跟着变。
 */
export const itemStatFields = [
  ["ad", "攻击力"], ["ap", "法术强度"], ["hp", "生命值"], ["mana", "法力"],
  ["armor", "护甲"], ["mr", "魔抗"], ["attack_speed", "攻击速度%"], ["crit", "暴击%"],
  ["ability_haste", "技能急速"], ["move_speed_flat", "移动速度"], ["move_speed_pct", "移动速度%"],
  ["lethality", "穿甲"], ["armor_pen_pct", "护甲穿透%"], ["magic_pen_flat", "法术穿透"],
  ["magic_pen_pct", "法术穿透%"], ["life_steal", "生命偷取%"], ["omnivamp", "全能吸血%"],
  ["tenacity", "韧性%"], ["heal_shield_power", "治疗护盾强度%"],
] as const;

export type ItemStatKey = (typeof itemStatFields)[number][0];

export interface ItemComponent {
  id: string;
  qty: number;
}

export interface Item extends Record<ItemStatKey, number> {
  id: string;
  name: string;
  plaintext: string | null;
  description: string;
  tags_zh: string[];
  categories: string[];
  tier: string;
  gold_total: number;
  gold_sell: number;
  icon: string;
  components: ItemComponent[];
  builds_into: string[];
}

export interface Rune {
  id: number;
  key: string;
  name: string;
  short_desc: string;
  long_desc: string;
  icon_url: string | null;
  desc_source: string;
}

export interface RuneTree {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: Rune[][];
}

export interface StatMod {
  id: number;
  name: string;
  row_no: number;
  position: number;
  stat: string;
  icon_url: string;
}

export interface SummonerSpell {
  id: string;
  key: string;
  name: string;
  description: string;
  level: number;
  cooldown: string;
  icon: string;
}

/**
 * 英文原案（lolwiki 副源）。与 CDN 中文数据相互独立：
 * `stats`/`attrs`/`notes` 在中文源里没有对应项，缺失时应留空而不是拿中文顶替。
 */
export interface WikiAbility {
  slot: "P" | "Q" | "W" | "E" | "R" | null;
  name: string;
  type: string | null;
  description: string;
  flavor: string;
  /** 数值网格，如 { Cost: "55 / 65 / 75 / 85 / 95 mana", Width: "200" } */
  stats: Record<string, string>;
  /** 机制属性，如 { "Spell shield": "Blocked", Projectile: "Blocked" } */
  attrs: Record<string, string>;
  /** 机制备注正文 */
  notes: string[];
}

export interface WikiChampion {
  name_zh: string;
  wiki_title: string;
  abilities: WikiAbility[];
  patch_history: string[];
  trivia: string[];
}

/** 版本时间线：某个版本里某字段的 [旧值, 新值] */
export interface TimelineChange {
  v: string;
  c?: Record<string, [number, number]>;
  d?: 1;
}

export interface ChampionTimelineChange extends TimelineChange {
  c: Record<string, [number, number]>;
}

export interface LolTimeline {
  versions: string[];
  champions: Record<string, ChampionTimelineChange[]>;
  items: Record<string, TimelineChange[]>;
}

/**
 * 浏览器拿到的数据集 —— pipeline 输出的快照**去掉 `wiki`** 之后的样子。
 *
 * 英文原案（`wiki`，按英雄 id 索引）占了快照 58% 的体积，却只在详情页切到
 * "EN 原案"时才用得上，所以构建时被拆成每个英雄一个文件（见 `build/data-assets.ts`），
 * 需要时用 `loadChampionWiki` 按 `champion.key` 取。
 */
export interface LolData {
  meta: { version: string; tx_version?: string; built_at?: string };
  champions: Champion[];
  items: Item[];
  trees: RuneTree[];
  stat_mods: StatMod[];
  summoner: SummonerSpell[];
  /** 版本改动（逐字段 diff） */
  timeline?: LolTimeline;
}

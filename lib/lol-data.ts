export interface Spell {
  slot: "P" | "Q" | "W" | "E" | "R";
  name: string;
  description: string;
  cooldown: string | null;
  cost: string | null;
  range_: string | null;
  icon_url: string | null;
}

export interface Champion {
  key: string;
  id: string;
  name: string;
  epithet: string;
  blurb: string;
  partype: string;
  tags_zh: string[];
  tag_primary: string | null;
  tag_secondary: string | null;
  attack_type: string | null;
  damage_type: string | null;
  hp: number;
  hp_per_level: number;
  armor: number;
  spellblock: number;
  attackdamage: number;
  attackspeed: number;
  attackrange: number;
  movespeed: number;
  icon: string;
  spells: Spell[];
}

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

export interface LolData {
  meta: { version: string; tx_version?: string; built_at?: string };
  champions: Champion[];
  items: Item[];
  trees: RuneTree[];
  stat_mods: StatMod[];
  summoner: SummonerSpell[];
}

export async function loadLolData(signal?: AbortSignal): Promise<LolData> {
  const response = await fetch("/data/lol.json", { signal });
  if (!response.ok) throw new Error(`数据加载失败（HTTP ${response.status}）`);
  return response.json() as Promise<LolData>;
}

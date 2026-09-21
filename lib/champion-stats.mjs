/**
 * 基础数值随等级的变化。纯函数、零依赖，所以 node 的 `--test` 能直接跑（见
 * tests/champion-stats.test.mjs），类型检查也能从 `@type {const}` 推出字面量。
 *
 * ## 成长不是线性的
 *
 * 英雄联盟的每级成长走的是**递增**曲线，不是 `base + growth × (等级−1)`：
 *
 * ```
 * 数值(n) = base + growth × (n−1) × (0.7025 + 0.0175 × (n−1))
 * ```
 *
 * 括号里那项就是「成长倍率」：1 级为 0（只有基础值），越往后每级涨得越多，
 * 到 18 级累计 18.055、到 20 级累计 19.665。用它验算盲僧：645 + 108 × 19.665 = 2768.82，
 * 与 lolwiki 一致。
 *
 * 等级上限取 20：常规对局是 18，但上单任务等模式会放宽上限，滑块要够得到。
 *
 * ## 攻速是另一种算法
 *
 * 攻速的成长值单位是百分比，加的是**额外攻速**，再乘上攻速比率：
 *
 * ```
 * 攻速(n) = 基础攻速 + 攻速比率 × 成长% / 100 × 成长倍率(n)
 * ```
 *
 * 大多数英雄的攻速比率等于基础攻速，此时等价于 `基础攻速 × (1 + 额外攻速)`；
 * 少数英雄两者不同（艾希、格雷福斯、阿克尚、赛娜），比率才是对的缩放基准。
 * 烬的比率是 0 —— 他不按这套结算，界面上显示为 N/A。
 */

/** 等级范围：常规对局 18，任务模式可到 20 */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

/**
 * 成长倍率：`growth` 要乘多少才等于该等级相对 1 级的累计成长。
 *
 * @param {number} level
 * @returns {number}
 */
export function growthFactor(level) {
  if (level <= 1) return 0;
  const steps = level - 1;
  return steps * (0.7025 + 0.0175 * steps);
}

/**
 * 线性成长的属性在某等级的值（生命、护甲、魔抗、攻击力、回复…）。
 *
 * @param {number} base 1 级基础值
 * @param {number} growth 每级成长值
 * @param {number} level
 * @returns {number}
 */
export function statAtLevel(base, growth, level) {
  return base + growth * growthFactor(level);
}

/**
 * 该等级累计的额外攻速（百分比，比如 18 级盲僧是 54.2）。
 *
 * @param {number} growthPercent 每级成长的百分比（数据里的 `attackspeed_per_level`）
 * @param {number} level
 * @returns {number}
 */
export function bonusAttackSpeedPercent(growthPercent, level) {
  return growthPercent * growthFactor(level);
}

/**
 * 某等级的面板攻速。
 *
 * @param {number} base 1 级基础攻速
 * @param {number} ratio 攻速比率（等于基础攻速时即常规缩放）
 * @param {number} growthPercent 每级攻速成长的百分比
 * @param {number} level
 * @returns {number}
 */
export function attackSpeedAtLevel(base, ratio, growthPercent, level) {
  return base + ratio * (growthPercent / 100) * growthFactor(level);
}

/**
 * 界面要展示哪些属性 —— 单一来源，标签、单位、取哪两个字段都在这里。
 *
 * `kind` 决定怎么算：`linear` 走 `statAtLevel`，`attackspeed` 走 `attackSpeedAtLevel`，
 * `fixed` 是不随等级变的常数（射程、移速、暴击伤害）。
 *
 * @type {ReadonlyArray<{key: string, label: string, base: string, growth?: string, kind: "linear" | "attackspeed" | "fixed", digits: number, suffix?: string, ratio?: string}>}
 */
export const LEVEL_SCALED_STATS = [
  { key: "hp", label: "生命", base: "hp", growth: "hp_per_level", kind: "linear", digits: 2 },
  { key: "hpregen", label: "生命回复", base: "hpregen", growth: "hpregen_per_level", kind: "linear", digits: 2, suffix: "/5秒" },
  { key: "attackdamage", label: "攻击力", base: "attackdamage", growth: "attackdamage_per_level", kind: "linear", digits: 2 },
  { key: "armor", label: "护甲", base: "armor", growth: "armor_per_level", kind: "linear", digits: 2 },
  { key: "spellblock", label: "魔抗", base: "spellblock", growth: "spellblock_per_level", kind: "linear", digits: 2 },
  { key: "mp", label: "资源", base: "mp", growth: "mp_per_level", kind: "linear", digits: 0 },
  { key: "mpregen", label: "资源回复", base: "mpregen", growth: "mpregen_per_level", kind: "linear", digits: 2, suffix: "/5秒" },
  { key: "attackspeed", label: "攻速", base: "attackspeed", growth: "attackspeed_per_level", ratio: "attackspeed_ratio", kind: "attackspeed", digits: 3 },
];

/**
 * 不随等级变的属性。`percent` 表示数据里存的是倍率/比例，显示时要换算（暴击伤害 2 → 200%）。
 *
 * @type {ReadonlyArray<{key: string, label: string, digits?: number, percent?: boolean}>}
 */
export const FIXED_STATS = [
  { key: "movespeed", label: "移动速度" },
  { key: "attackrange", label: "攻击距离" },
  { key: "crit_damage", label: "暴击伤害", percent: true },
  { key: "attackspeed_ratio", label: "攻速比率", digits: 3 },
];

/** 单位几何（来自游戏数据，lolwiki 的那一块） */
export const UNIT_RADIUS_STATS = [
  { key: "pathing_radius", label: "碰撞半径" },
  { key: "selection_radius", label: "选中半径" },
  { key: "selection_height", label: "选中高度" },
  { key: "acquisition_range", label: "获取范围" },
];

/** 按描述符取某等级的值；字段缺失返回 null（调用方显示占位符） */
export function valueAtLevel(champion, descriptor, level) {
  const base = champion[descriptor.base];
  const growth = descriptor.growth === undefined ? 0 : champion[descriptor.growth];
  if (typeof base !== "number") return null;
  if (descriptor.kind === "fixed") return base;
  if (descriptor.kind === "attackspeed") {
    const ratio = typeof champion[descriptor.ratio] === "number" ? champion[descriptor.ratio] : base;
    return attackSpeedAtLevel(base, ratio, growth ?? 0, level);
  }
  return statAtLevel(base, growth ?? 0, level);
}

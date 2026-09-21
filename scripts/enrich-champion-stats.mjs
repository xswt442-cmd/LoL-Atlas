/**
 * 从 CommunityDragon 补齐英雄的基础数值与成长值。
 *
 * 为什么需要这一步：ddragon 的 `attackdamageperlevel` 在当前版本对**全部 173 个英雄都是 0**
 * （线上数据自身如此，不是管道丢的），而 CommunityDragon 的角色记录里有真实值。
 * 顺带把 ddragon 完全没有的几项也取回来：攻速比率、暴击伤害倍率、单位几何。
 *
 * 数据源：`https://raw.communitydragon.org/<游戏版本>/game/data/characters/<别名>/<别名>.bin.json`
 * 取其中 `Characters/<别名>/CharacterRecords/Root` 这一段。注意：
 *   - CD 的版本目录是 **major.minor**（`16.18`），不是 `16.18.1`
 *   - 路径里的别名是英雄 id 的小写形式（`LeeSin` → `leesin`，`Kha'Zix` → `khazix`）
 *   - 下载结果缓存到 `data/cache/communitydragon-<版本>/`，重跑不再走网络
 *
 * 字段映射（CD → 本项目）：
 *   damagePerLevelModifiable      → attackdamage_per_level   （修掉现值 0）
 *   attackSpeedRatioModifiable    → attackspeed_ratio
 *   critDamageMultiplier          → crit_damage
 *   pathfindingCollisionRadius    → pathing_radius
 *   selectionRadius               → selection_radius
 *   selectionHeight               → selection_height
 *   acquisitionRange              → acquisition_range
 *
 * **lolwiki 的「Gameplay radius」取不到**：CD 的角色记录只有上面四项几何，没有 gameplay
 * radius。这一项宁缺毋滥，不猜。
 *
 * 用法：
 *   node scripts/enrich-champion-stats.mjs --dry-run   # 只报告将要改什么
 *   node scripts/enrich-champion-stats.mjs             # 写入两份 lol.json
 *   node scripts/enrich-champion-stats.mjs --limit 5   # 只处理前 5 个英雄（冒烟用）
 *   npm run release:manifest                           # 写完必须重跑，让 sha256 跟上
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const publicPath = path.join(root, "public", "data", "lol.json");
const CACHE_ROOT = ["data", "cache"];

/** 请求 CommunityDragon 时用的 UA —— 默认的 node UA 会被它拒绝（403） */
const USER_AGENT = "lol-atlas-data-patch/1.0 (+https://lol-atlas.xswt.fyi)";

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : 0;

/** CD 的版本目录用 major.minor：数据版本 16.18.1 → 目录 16.18 */
function communityDragonVersion(dataVersion) {
  const [major, minor] = dataVersion.split(".");
  return `${major}.${minor}`;
}

/** 英雄 id → CD 目录名（小写、去掉非字母数字） */
const aliasFor = (championId) => championId.toLowerCase().replace(/[^a-z0-9]/g, "");

async function cachedRoot(alias, version) {
  const directory = path.join(root, ...CACHE_ROOT, `communitydragon-${version}`);
  const file = path.join(directory, `${alias}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // 未缓存：走网络
  }
  const url = `https://raw.communitydragon.org/${version}/game/data/characters/${alias}/${alias}.bin.json`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${alias}: HTTP ${response.status} ${url}`);
  const payload = await response.json();
  await mkdir(directory, { recursive: true });
  await writeFile(file, JSON.stringify(payload), "utf8");
  return payload;
}

/** 从整份角色数据里取出 Root 那段（键名形如 `Characters/LeeSin/CharacterRecords/Root`） */
function rootRecord(payload, alias) {
  const key = Object.keys(payload).find((entry) => entry.toLowerCase().endsWith("characterrecords/root"));
  if (!key) throw new Error(`${alias}: 角色数据里找不到 CharacterRecords/Root`);
  return payload[key];
}

/** ModifiableFloat 取 baseValue，普通数直接用；缺失返回 null */
function valueOf(record, key) {
  const raw = record[key];
  if (raw === undefined) return null;
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object" && typeof raw.baseValue === "number") return raw.baseValue;
  return null;
}

/**
 * ddragon 已有的字段与 CD 的交叉核对表。
 * CD 的值取整/取两位小数后应当与现有数据一致；不一致说明两边版本不同步，**必须报错**，
 * 不能静默用 CD 覆盖 —— 那样会悄悄改掉已经发布过的数值。
 */
const CROSS_CHECKS = [
  ["hp", "baseHPModifiable", 0],
  ["hp_per_level", "hpPerLevelModifiable", 0],
  ["armor", "baseArmorModifiable", 0],
  ["armor_per_level", "armorPerLevelModifiable", 0],
  ["spellblock", "baseMR", 0],
  ["spellblock_per_level", "mrPerLevel", 0],
  ["attackdamage", "baseDamageModifiable", 0],
  ["attackspeed", "attackSpeedModifiable", 3],
  ["attackspeed_per_level", "attackSpeedPerLevelModifiable", 0],
  ["attackrange", "attackRangeModifiable", 0],
  ["movespeed", "baseMoveSpeedModifiable", 0],
  // 生命回复：CD 按每秒给，我们按每 5 秒存
  ["hpregen", "baseStaticHPRegenModifiable", 1, 5],
  ["hpregen_per_level", "hpRegenPerLevelModifiable", 1, 5],
];

const round = (value, digits) => Number(value.toFixed(digits));

/** 读取现有数据并推导出要处理的版本 */
const data = JSON.parse(await readFile(publicPath, "utf8"));
const version = data.meta?.version;
if (!version) throw new Error(`${publicPath} 缺少 meta.version`);
const cdVersion = communityDragonVersion(version);
const releasePath = path.join(root, "data", "releases", version, "lol.json");

const champions = limit ? data.champions.slice(0, limit) : data.champions;
console.log(`补数据：${champions.length} 个英雄，数据版本 ${version}，CD 目录 ${cdVersion}`);

const mismatches = [];
const stats = { adGrowthFixed: [], adGrowthSame: 0, checked: 0 };
const zeroGrowth = [];
// 各几何字段在 CD 里缺失的英雄数。缺失即不写入 —— 写 0 会被读成“范围真的是 0”
const absent = new Map();

for (const champion of champions) {
  const alias = aliasFor(champion.id);
  const record = rootRecord(await cachedRoot(alias, cdVersion), alias);

  for (const [field, source, digits, scale = 1] of CROSS_CHECKS) {
    const theirs = valueOf(record, source);
    if (theirs === null || typeof champion[field] !== "number") continue;
    stats.checked += 1;
    const expected = round(theirs * scale, digits);
    if (Math.abs(champion[field] - expected) > 10 ** -digits) {
      mismatches.push(`${champion.id} ${field}: 本地 ${champion[field]} vs CD ${expected} (${source}${scale === 5 ? " ×5" : ""})`);
    }
  }

  const adGrowth = valueOf(record, "damagePerLevelModifiable");
  // 字段缺失是**有意义的**：Senna 的基础 AD 靠灵魂而不是等级成长，她的角色记录里就没有
  // 这个字段（同类的还有 Thresh 零护甲成长、Jhin/Belveth 零攻速成长）。抓取失败会在
  // cachedRoot 里直接抛错，所以能走到这里就说明记录确实取到了。
  const nextAd = adGrowth === null ? 0 : round(adGrowth, 2);
  if (adGrowth === null) zeroGrowth.push(`${champion.id}（CD 记录无该字段，按 0 处理）`);
  if (champion.attackdamage_per_level === nextAd) stats.adGrowthSame += 1;
  else stats.adGrowthFixed.push(`${champion.id} ${champion.attackdamage_per_level} → ${nextAd}`);

  // 几何字段缺失时**不写**该字段，而不是写 0：CD 里有些英雄根本没有 acquisitionRange，
  // 写 0 会被读成"获取范围 0"，而真相是"这份数据没提供"。存在但值为 0 的（Zed 的选择高度）
  // 照原样保留 —— 那是游戏数据本身的值。
  const optional = {
    attackspeed_ratio: [valueOf(record, "attackSpeedRatioModifiable"), 4],
    crit_damage: [valueOf(record, "critDamageMultiplier"), 3],
    pathing_radius: [valueOf(record, "pathfindingCollisionRadius"), 2],
    selection_radius: [valueOf(record, "selectionRadius"), 2],
    selection_height: [valueOf(record, "selectionHeight"), 2],
    acquisition_range: [valueOf(record, "acquisitionRange"), 2],
  };
  const additions = { attackdamage_per_level: nextAd };
  for (const [field, [raw, digits]] of Object.entries(optional)) {
    if (raw === null) {
      absent.set(field, (absent.get(field) ?? 0) + 1);
      // 删掉旧值：以前按 0 写过，光"跳过"会把那个 0 留在数据里
      if (!dryRun) delete champion[field];
      continue;
    }
    additions[field] = round(raw, digits);
  }
  for (const [field, value] of Object.entries(additions)) {
    if (dryRun) continue;
    champion[field] = value;
  }
}

console.log(`\n交叉核对：比对了 ${stats.checked} 个已有字段`);
if (mismatches.length) {
  console.error(`发现 ${mismatches.length} 处与 CD 不一致（两边版本可能不同步）：`);
  for (const line of mismatches.slice(0, 10)) console.error(`  ${line}`);
  console.error("未写入任何文件。先确认哪边是对的。");
  process.exit(1);
}
console.log("  全部一致");

console.log(`\nAD 成长：修正 ${stats.adGrowthFixed.length} 个，本就相同 ${stats.adGrowthSame} 个`);
for (const line of stats.adGrowthFixed.slice(0, 5)) console.log(`  ${line}`);
if (stats.adGrowthFixed.length > 5) console.log(`  …另 ${stats.adGrowthFixed.length - 5} 个`);
if (absent.size) {
  console.log("\nCD 未提供的几何字段（按缺失处理，不写 0）：");
  for (const [field, count] of absent) console.log(`  ${field.padEnd(20)} 缺 ${count} 个英雄`);
}
if (zeroGrowth.length) {
  console.log(`\n零成长（CD 记录里没有该字段，不是抓取失败）：`);
  for (const line of zeroGrowth) console.log(`  ${line}`);
}

if (dryRun) {
  console.log("\n--dry-run：未写入文件。");
  process.exit(0);
}

// 原文件是单行压缩格式，两份必须逐字节一致
const serialized = JSON.stringify(data);
await writeFile(releasePath, serialized, "utf8");
await writeFile(publicPath, serialized, "utf8");
console.log(`\n已写入两份 lol.json（${(serialized.length / 1048576).toFixed(2)} MB）：`);
console.log(`  ${path.relative(root, publicPath)}`);
console.log(`  ${path.relative(root, releasePath)}`);
console.log("记得跑 npm run release:manifest 让 manifest 里的 sha256 跟上");

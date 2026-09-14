import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PATCH_PATTERN = /^\d+\.\d+\.\d+$/;
const SPELL_SLOTS = ["P", "Q", "W", "E", "R"];

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateData(data) {
  const errors = [];
  assert(PATCH_PATTERN.test(data?.meta?.version ?? ""), "meta.version must be a three-part patch", errors);
  assert(Array.isArray(data?.champions) && data.champions.length > 150, "champions must contain a complete roster", errors);
  assert(Array.isArray(data?.items) && data.items.length > 100, "items must contain a complete catalog", errors);
  assert(data?.trees?.length === 5, "rune trees must contain five trees", errors);
  assert(data?.stat_mods?.length === 9, "stat mods must contain three rows of three", errors);
  assert(data?.summoner?.length >= 8, "summoner spells must contain the standard set", errors);

  const champions = data?.champions ?? [];
  assert(!champions.some((champion) => champion.id?.startsWith("Jade_")), "Jade_* variants are not canonical champions", errors);
  assert(duplicates(champions.map((champion) => champion.key)).length === 0, "champion keys must be unique", errors);
  assert(duplicates(champions.map((champion) => champion.id)).length === 0, "champion ids must be unique", errors);
  for (const champion of champions) {
    const slots = champion.spells?.map((spell) => spell.slot) ?? [];
    assert(SPELL_SLOTS.every((slot) => slots.includes(slot)) && new Set(slots).size === 5,
      `champion ${champion.id} must have exactly P/Q/W/E/R`, errors);
    // 英文简介与拼音首字母是 UI 的硬依赖（EN 原案简介 / 字母索引），缺了要在这里拦下
    assert(typeof champion.blurb_en === "string" && champion.blurb_en.length > 0,
      `champion ${champion.id} must carry an English blurb`, errors);
    assert(/^[A-Z]$/.test(champion.initial ?? ""),
      `champion ${champion.id} must carry a single A-Z pinyin initial`, errors);
    // 皮肤：只保留真皮肤（炫彩条目在 ddragon 上没有原画，且会让前端狂刷 onError）。
    // 这里拦的是「上游重新生成数据、没跑 enrich 脚本」的情况。
    const skins = champion.skins ?? [];
    assert(skins.length >= 1, `champion ${champion.id} must expose at least one skin`, errors);
    assert(duplicates(skins.map((skin) => skin.num)).length === 0,
      `champion ${champion.id} has duplicate skin nums`, errors);
    for (const skin of skins) {
      assert(Number.isInteger(skin.chroma_count) && skin.chroma_count >= 0,
        `champion ${champion.id} skin ${skin.num} must carry a numeric chroma_count`, errors);
    }
    assert(!skins.some((skin) => "chromas" in skin),
      `champion ${champion.id} still carries the old boolean chromas field`, errors);
  }

  const items = data?.items ?? [];
  const itemIds = new Set(items.map((item) => item.id));
  assert(duplicates(items.map((item) => item.id)).length === 0, "item ids must be unique", errors);
  for (const item of items) {
    for (const component of item.components ?? []) {
      assert(itemIds.has(component.id), `item ${item.id} references missing component ${component.id}`, errors);
      assert(Number.isInteger(component.qty) && component.qty >= 1, `item ${item.id} has invalid component quantity`, errors);
    }
    for (const upgradeId of item.builds_into ?? []) {
      assert(itemIds.has(upgradeId), `item ${item.id} references missing upgrade ${upgradeId}`, errors);
    }
    const hasComponents = (item.components ?? []).length > 0;
    const hasUpgrades = (item.builds_into ?? []).length > 0;
    const expectedTier = hasComponents ? (hasUpgrades ? "史诗" : "成品") : (hasUpgrades ? "基础件" : "独立");
    assert(item.tier === expectedTier, `item ${item.id} tier must be ${expectedTier}, received ${item.tier}`, errors);
  }

  const statRows = new Map();
  for (const mod of data?.stat_mods ?? []) statRows.set(mod.row_no, (statRows.get(mod.row_no) ?? 0) + 1);
  assert(statRows.size === 3 && [...statRows.values()].every((count) => count === 3), "stat mods must be grouped 3 x 3", errors);

  // 英文原案副源：按 champion.id 索引，必须覆盖全部英雄且每个英雄 P/Q/W/E/R 齐全。
  // 这是 UI 里「EN 原案」视图的唯一数据来源，缺一块就会静默少显示一个技能。
  const wiki = data?.wiki;
  assert(wiki && typeof wiki === "object", "wiki source must be present and keyed by champion id", errors);
  for (const champion of champions) {
    const entry = wiki?.[champion.id];
    assert(Boolean(entry), `champion ${champion.id} is missing a wiki entry`, errors);
    if (!entry) continue;
    const slots = (entry.abilities ?? []).map((ability) => ability.slot).filter(Boolean);
    assert(SPELL_SLOTS.every((slot) => slots.includes(slot)),
      `wiki ${champion.id} must cover P/Q/W/E/R`, errors);
    for (const ability of entry.abilities ?? []) {
      if (!ability?.slot) continue;
      assert(typeof ability.name === "string" && ability.name.length > 0,
        `wiki ${champion.id} ${ability.slot} must have an ability name`, errors);
      assert(typeof ability.description === "string" && ability.description.length > 0,
        `wiki ${champion.id} ${ability.slot} must have a description`, errors);
    }
  }
  return errors;
}

export async function validateDataFile(filename) {
  const data = JSON.parse(await readFile(filename, "utf8"));
  return { data, errors: validateData(data) };
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsScript) {
  const filename = path.resolve(process.argv[2] ?? "public/data/lol.json");
  const { data, errors } = await validateDataFile(filename);
  if (errors.length) {
    console.error(`Data validation failed (${errors.length}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Data validation passed: patch ${data.meta.version}, ${data.champions.length} champions, ${data.items.length} items.`);
  }
}

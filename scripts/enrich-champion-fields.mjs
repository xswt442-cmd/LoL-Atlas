/**
 * 给发布数据补两个派生字段：
 *   - blurb_en：英文简介，作为中文 blurb 的对照（来源 ddragon en_US）
 *   - initial ：中文名拼音首字母，供英雄索引按字母分组
 *
 * 数据管道不在本仓库，所以这一步以「补丁脚本」形式存在：它会同时改写
 * `data/releases/<patch>/lol.json` 与 `public/data/lol.json`（两者必须逐字节一致），
 * 之后必须重跑 `npm run release:manifest` 让 manifest 里的 sha256 跟上。
 *
 * 用法：
 *   mkdir -p data/cache
 *   curl -s -o data/cache/en_US_championFull.json \
 *     https://ddragon.leagueoflegends.com/cdn/<patch>/data/en_US/championFull.json
 *   node scripts/enrich-champion-fields.mjs
 *   npm run release:manifest
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const publicPath = path.join(root, "public", "data", "lol.json");
const enPath = path.join(root, "data", "cache", "en_US_championFull.json");
const initialsPath = path.join(root, "data", "champion-initials.json");

const english = JSON.parse(await readFile(enPath, "utf8")).data;
const initials = JSON.parse(await readFile(initialsPath, "utf8"));
const data = JSON.parse(await readFile(publicPath, "utf8"));

const releasePath = path.join(root, "data", "releases", data.meta.version, "lol.json");

let withBlurb = 0;
const missingBlurb = [];
const missingInitial = [];
let skinsKept = 0;
let skinsDroppedChroma = 0;
let skinsUnknown = 0;
for (const champion of data.champions) {
  const source = english[champion.id];
  if (source?.blurb) {
    champion.blurb_en = source.blurb;
    withBlurb += 1;
  } else {
    missingBlurb.push(champion.id);
  }
  if (initials[champion.key]) champion.initial = initials[champion.key];
  else missingInitial.push(champion.id);

  if (Array.isArray(champion.skins) && Array.isArray(source?.skins)) {
    const parents = new Map(source.skins.map((skin) => [skin.num, skin.parentSkin]));
    const kept = [];
    for (const skin of champion.skins) {
      if (parents.has(skin.num) && parents.get(skin.num) !== undefined) {
        skinsDroppedChroma += 1;
        continue;
      }
      if (!parents.has(skin.num)) skinsUnknown += 1;
      kept.push({
        num: skin.num,
        name: skin.name,
        chroma_count: source.skins.filter((entry) => entry.parentSkin === skin.num).length,
      });
    }
    champion.skins = kept;
    skinsKept += kept.length;
  }
}

// 原文件是单行压缩格式，保持一致，避免整篇重排
const serialized = JSON.stringify(data);
await writeFile(releasePath, serialized, "utf8");
await writeFile(publicPath, serialized, "utf8");

console.log(`patch ${data.meta.version}：${data.champions.length} 英雄`);
console.log(`  blurb_en 写入 ${withBlurb}${missingBlurb.length ? `，缺 ${missingBlurb.length}（${missingBlurb.slice(0, 5).join(", ")}）` : ""}`);
console.log(`  initial  写入 ${data.champions.length - missingInitial.length}${missingInitial.length ? `，缺 ${missingInitial.length}（${missingInitial.slice(0, 5).join(", ")}）` : ""}`);
console.log(`  皮肤     保留 ${skinsKept}，剔除炫彩 ${skinsDroppedChroma}${skinsUnknown ? `，ddragon 未收录 ${skinsUnknown}` : ""}`);
console.log("  两份 lol.json 已同步，记得跑 npm run release:manifest");

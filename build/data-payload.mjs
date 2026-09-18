// Build-time splitting of the published snapshot, kept out of the Vite plugin so
// it can be unit-tested (see tests/build-payload.test.mjs).
import { createHash } from "node:crypto";

export const HASH_LENGTH = 8;
// Deliberately *not* content-addressed: outside consumers (the shields.io patch
// badge in both READMEs) need one URL that stays put. It holds only `meta`, so
// it is a few hundred bytes and can carry a short max-age instead.
export const META_FILENAME = "meta.json";
export const WIKI_DIRECTORY = "wiki";

/**
 * @typedef {object} DataPayloads
 * @property {string} hash              数据版本标识
 * @property {string} mainFilename      主载荷在 `data/` 下的文件名
 * @property {string} main              浏览器拿到的主载荷（已剥掉 `wiki`）
 * @property {string} meta              固定路径 `meta.json` 的内容
 * @property {Map<string, string>} shards wiki 分片：文件名 → 内容
 */

/**
 * 把发布快照拆成浏览器需要的几份，并给主载荷算内容哈希。
 *
 * hash 覆盖的是**实际载荷**而不是源文件：拆法一变载荷就变，URL 必须跟着变，
 * 否则挂着 `immutable` 的旧 URL 会继续吐出旧形状（这个坑踩过一次）。
 *
 * @param {object} dataset `public/data/lol.json` 解析后的对象
 * @returns {DataPayloads}
 */
export function buildDataPayloads(dataset) {
  const { wiki = {}, ...rest } = dataset ?? {};
  const keyByChampionId = new Map((rest.champions ?? []).map((champion) => [champion.id, champion.key]));
  const main = JSON.stringify(rest);
  const hash = createHash("sha256").update(main).digest("hex").slice(0, HASH_LENGTH);

  const shards = new Map();
  for (const [championId, entry] of Object.entries(wiki)) {
    // 分片按 `champion.key`（数字）命名，不用英雄 id —— `Kha'Zix` 这类 id 进 URL
    // 需要百分号转义，而静态资源按原始路径匹配。
    const key = keyByChampionId.get(championId);
    // 没有对应英雄的 wiki 条目没有页面可以渲染。
    if (key) shards.set(`${key}.json`, JSON.stringify(entry));
  }

  return {
    hash,
    mainFilename: `lol.${hash}.json`,
    main,
    meta: JSON.stringify(rest.meta ?? {}),
    shards,
  };
}

/**
 * 数据取数层：把构建产物取回来，其它什么都不做。
 *
 * 两个 URL 都是构建时注入的常量（`build/data-assets.ts` 通过 Vite 的 `define` 写入，
 * 见根目录 `globals.d.ts`）—— 路径里带内容哈希，所以边缘可以按 immutable 缓存。
 */

import type { LolData, WikiChampion } from "./lol-types";

export async function loadLolData(signal?: AbortSignal): Promise<LolData> {
  const response = await fetch(__LOL_DATA_URL__, { signal });
  if (!response.ok) throw new Error(`数据加载失败（HTTP ${response.status}）`);
  return response.json() as Promise<LolData>;
}

/**
 * 取单个英雄的英文原案（lolwiki 副源）。
 *
 * 按 `champion.key` 命名分片，而不是英雄 id —— id 里有 `Kha'Zix`、`Kog'Maw`
 * 这类字符，塞进 URL 需要百分号转义，而静态资源按原始路径匹配。
 * 该英雄没有原案条目时返回 null。
 */
export async function loadChampionWiki(key: string, signal?: AbortSignal): Promise<WikiChampion | null> {
  const response = await fetch(`${__LOL_WIKI_BASE__}/${key}.json`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`英文原案加载失败（HTTP ${response.status}）`);
  return response.json() as Promise<WikiChampion>;
}

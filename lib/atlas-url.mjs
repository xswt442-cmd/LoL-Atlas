/**
 * 地址栏状态的唯一出入口：解析、序列化、以及"该 push 还是 replace"的判定。
 *
 * 三件事放同一个模块，因为三者共享同一份 URL 格式（参数名、顺序、哪些值可以省略）。
 * 以前读取在组件里、写入在另一个 effect 里，格式一变就得两处手改，漏一处就错位。
 *
 * 只依赖 `lib/atlas-tabs.mjs`（纯数据），所以 node 的 `--test` 能直接加载它，
 * 不必经过打包。
 */

import { isAtlasTab } from "./atlas-tabs.mjs";

/** URL 格式版本，出现在 `v=` 参数里，将来改格式时用于区分旧链接 */
export const URL_VERSION = "1";

/** 配装最多六件，链接里带再多也只取前六个 */
export const MAX_LOADOUT_ITEMS = 6;

/**
 * 从 query string 解析出页面状态。
 *
 * @param {string} search 形如 `?v=1&tab=items&id=1001`，可以带前导 `?`
 * @returns {{ tab: string, query: string, selectedId: string, itemIds: string[] }}
 */
export function readAtlasState(search) {
  const params = new URLSearchParams(search);
  const requested = params.get("tab");
  return {
    tab: requested !== null && isAtlasTab(requested) ? requested : "champions",
    query: params.get("q") ?? "",
    selectedId: params.get("id") ?? "",
    itemIds: (params.get("b") ?? "").split(",").filter(Boolean).slice(0, MAX_LOADOUT_ITEMS),
  };
}

/**
 * 把页面状态序列化成 query string（带前导 `?`）。
 *
 * 省略等于默认值的参数，保证同一状态只有一种写法 —— 否则同一页面会有多个 URL，
 * 分享出去的链接变得不可预测。
 *
 * @param {{ tab: string, query: string, selectedId: string, itemIds: string[] }} state
 * @returns {string}
 */
export function writeAtlasState({ tab, query, selectedId, itemIds }) {
  const params = new URLSearchParams();
  params.set("v", URL_VERSION);
  if (tab !== "champions") params.set("tab", tab);
  if (query) params.set("q", query);
  // 配装页的选中项没有意义，它自己由 `b=` 承载
  if (selectedId && tab !== "builder") params.set("id", selectedId);
  if (itemIds.length) params.set("b", itemIds.join(","));
  return `?${params.toString()}`;
}

/**
 * 判定这次写入该 push（留下一条可后退的历史）还是 replace（原地覆盖）。
 *
 * 判定错了两个方向都会被用户看见：一律 replace 会让后退直接离开站点，
 * 一律 push 会让输入英雄名时每敲一个字符压一条历史。
 *
 * @param {{ tab: string, selectedId: string } | null} previous 上一次写入地址栏的组合；null 表示本次是首屏
 * @param {{ tab: string, selectedId: string }} current
 * @returns {"push" | "replace"}
 */
export function historyActionFor(previous, current) {
  // 还没有可返回的上一页，第一次写入只是建立 URL
  if (previous === null) return "replace";
  // 换模块、或落到另一条记录，都算一次导航
  if (previous.tab !== current.tab) return "push";
  if (previous.selectedId !== current.selectedId) return "push";
  // 搜索词与配装增删只是重写当前这一页
  return "replace";
}

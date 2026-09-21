/**
 * 模块（tab）清单 —— 取值与名称的唯一来源。
 *
 * 三处要用同一份清单：地址栏解析（`lib/atlas-url.mjs`）、侧边导航
 * （`components/atlas/atlas-nav.tsx`）、WebMCP 工具的枚举（`hooks/use-atlas-webmcp.ts`）。
 * 以前这份清单长在导航组件里，另外两处各自重复一份。
 *
 * 用 `.mjs` 而不是 `.ts`：node 的 `--test` 要能直接加载它来跑地址栏用例，
 * 同时类型检查仍能从 `@type {const}` 推断出字面量联合。
 *
 * 图标不在这里 —— 图标是渲染细节，由导航组件用 `Record<AtlasTab, …>` 补齐，
 * 漏一个会被类型检查拦住。
 */
export const ATLAS_TABS = /** @type {const} */ ([
  { value: "champions", label: "英雄" },
  { value: "items", label: "装备" },
  { value: "runes", label: "符文" },
  { value: "summoner", label: "召唤师技能" },
  { value: "builder", label: "配装" },
]);

export const ATLAS_TAB_VALUES = ATLAS_TABS.map((tab) => tab.value);

/** 取值是否是一个合法模块
 * @param {string | null} value */
export const isAtlasTab = (value) => ATLAS_TABS.some((tab) => tab.value === value);

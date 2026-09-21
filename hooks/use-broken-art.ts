"use client";

import { useState } from "react";

/**
 * 记录"哪些图加载失败"，键由调用方自己拼。
 *
 * 关键在于**只用状态记账，绝不把节点从 DOM 里 remove 掉**：命令式 remove 会让
 * React 的 fiber 树和真实 DOM 脱节，之后任何一次提交只要需要卸载那个节点，就会抛
 * "Failed to execute 'removeChild' on 'Node'" 把页面打崩。
 *
 * 状态跟着组件实例走，所以详情页要按记录加 `key`，失败记录才不会串到下一条。
 */
export function useBrokenArt() {
  const [broken, setBroken] = useState<Record<string, true>>({});

  return {
    isBroken: (key: string) => Boolean(broken[key]),
    markBroken: (key: string) => setBroken((previous) => (previous[key] ? previous : { ...previous, [key]: true })),
  };
}

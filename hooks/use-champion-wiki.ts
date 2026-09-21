"use client";

import { useEffect, useState } from "react";

import { loadChampionWiki } from "@/lib/lol-data";
import type { WikiChampion } from "@/lib/lol-types";

/**
 * 按需取单个英雄的英文原案。
 *
 * 只在 `enabled` 为真时发请求：原案占了快照 58% 的体积，却只在详情页切到"EN 原案"
 * 时才看得见，所以构建时把它拆成了一个英雄一个文件（见 `build/data-assets.ts`）。
 *
 * `wiki` 的三种取值都有意义：`undefined` = 还没取、`null` = 这个英雄没有原案条目、
 * 对象 = 取到了。调用方据此决定"还没加载""没有原案""显示原案"。
 */
export function useChampionWiki(key: string, enabled: boolean) {
  const [wiki, setWiki] = useState<WikiChampion | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || wiki !== undefined || failed) return;
    const controller = new AbortController();
    loadChampionWiki(key, controller.signal)
      .then(setWiki)
      .catch((reason: unknown) => {
        // 切英雄导致的取消不算失败
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [enabled, failed, key, wiki]);

  return { wiki, failed, loading: enabled && wiki === undefined && !failed };
}

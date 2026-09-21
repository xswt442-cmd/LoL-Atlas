"use client";

import { useEffect, useState } from "react";

import { loadLolData } from "@/lib/lol-data";
import type { LolData } from "@/lib/lol-types";

/**
 * 拉取图鉴快照。
 *
 * 三个返回值刻意合成一个对象：调用方只关心"有没有数据 / 加载中 / 出错"，
 * 让它在外面自己推导 `loading` 容易漏掉"出错也算加载结束"这一条。
 */
export function useLolData() {
  const [data, setData] = useState<LolData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadLolData(controller.signal).then(setData).catch((reason: unknown) => {
      // 组件卸载导致的中断不是错误
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "数据加载失败");
    });
    return () => controller.abort();
  }, []);

  return { data, error, loading: !data && !error };
}

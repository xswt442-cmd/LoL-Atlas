"use client";

import { useEffect, useRef } from "react";

import { ATLAS_TAB_VALUES, isAtlasTab } from "@/lib/atlas-tabs.mjs";

/**
 * 把图鉴的当前状态与操作暴露成 WebMCP 工具，让外部智能体可以读状态、切模块、改配装。
 *
 * 抽成独立 hook 是因为这段逻辑有两处特殊约束，混在页面编排里容易被改坏：
 * 一是工具回调必须读到**最新**状态，所以用 ref 每次渲染刷新；
 * 二是注册只做一次，因此依赖数组必须为空，回调里不能直接闭包任何会变的值。
 */

interface WebMcpContext {
  registerTool(tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute(input: unknown): unknown;
  }, options?: { signal?: AbortSignal }): void | Promise<void>;
}

interface AtlasState {
  tab: string;
  query: string;
  selectedId: string;
  builderItemIds: string[];
  setTab: (tab: string) => void;
  setQuery: (query: string) => void;
  setSelectedId: (id: string) => void;
  setBuilderItemIds: (ids: string[]) => void;
}

export function useAtlasWebMcp(state: AtlasState) {
  const latest = useRef(state);
  // 每次渲染刷新，工具回调才能看到当前值。这里不能写依赖数组 —— 每次都是新对象。
  useEffect(() => {
    latest.current = state;
  });

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<WebMcpContext["registerTool"]>[0]) => {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    };

    register({
      name: "read_atlas_state",
      title: "读取图鉴状态",
      description: "读取当前 LOL Atlas 页面、搜索词、选中记录和配装。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        tab: latest.current.tab,
        query: latest.current.query,
        selectedId: latest.current.selectedId,
        builderItemIds: latest.current.builderItemIds,
      }),
    });

    register({
      name: "navigate_atlas",
      title: "打开图鉴记录",
      description: "切换 LOL Atlas 模块，可选设置搜索词和记录 ID。",
      inputSchema: {
        type: "object",
        properties: {
          tab: { type: "string", enum: [...ATLAS_TAB_VALUES] },
          query: { type: "string" },
          selectedId: { type: "string" },
        },
        required: ["tab"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (!input || typeof input !== "object") throw new Error("Invalid atlas navigation input");
        const value = input as { tab?: string; query?: string; selectedId?: string };
        if (!isAtlasTab(value.tab ?? null)) throw new Error("Unknown atlas tab");
        latest.current.setTab(value.tab as string);
        if (typeof value.query === "string") latest.current.setQuery(value.query);
        if (typeof value.selectedId === "string") latest.current.setSelectedId(value.selectedId);
        return {
          tab: value.tab,
          query: value.query ?? latest.current.query,
          selectedId: value.selectedId ?? latest.current.selectedId,
        };
      },
    });

    register({
      name: "set_atlas_loadout",
      title: "设置配装",
      description: "用最多六个装备 ID 替换当前 LOL Atlas 配装，并打开配装实验台。",
      inputSchema: {
        type: "object",
        properties: { itemIds: { type: "array", maxItems: 6, items: { type: "string" } } },
        required: ["itemIds"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (!input || typeof input !== "object" || !Array.isArray((input as { itemIds?: unknown }).itemIds)) {
          throw new Error("itemIds must be an array");
        }
        const itemIds = (input as { itemIds: unknown[] }).itemIds;
        if (itemIds.length > 6 || itemIds.some((id) => typeof id !== "string" || !id)) {
          throw new Error("Invalid itemIds");
        }
        latest.current.setBuilderItemIds(itemIds as string[]);
        latest.current.setTab("builder");
        return { tab: "builder", itemIds };
      },
    });

    return () => lifecycle.abort();
  }, []);
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Database, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { AtlasNav } from "@/components/atlas/atlas-nav";
import { BuilderWorkspace } from "@/components/atlas/builder-workspace";
import { ChampionWorkspace } from "@/components/atlas/champion-workspace";
import { ItemWorkspace } from "@/components/atlas/item-workspace";
import { RuneWorkspace } from "@/components/atlas/rune-workspace";
import { SummonerWorkspace } from "@/components/atlas/summoner-workspace";
import { useAtlasWebMcp } from "@/hooks/use-atlas-webmcp";
import { useLolData } from "@/hooks/use-lol-data";
import { historyActionFor, MAX_LOADOUT_ITEMS, readAtlasState, writeAtlasState } from "@/lib/atlas-url.mjs";

/**
 * 页面编排：持有跨模块状态（模块、搜索词、各模块选中项、配装），把它与地址栏保持同步，
 * 然后分派到各自的模块组件。
 *
 * 各模块内部的状态（定位筛选、装备分类、复制反馈…）不在这里，由模块组件自己持有 ——
 * 否则这个文件又要变成"所有状态的寄存处"。
 */
export function AtlasShell({ initialSearchParams }: { initialSearchParams: string }) {
  const [initial] = useState(() => readAtlasState(initialSearchParams));
  const { data, error, loading } = useLolData();
  const [tab, setTab] = useState(initial.tab);
  const [query, setQuery] = useState(initial.query);
  // 每个模块各记一份选中项：四个模块共用一份时，切过去会带着上一个模块的 id，
  // 而新模块里不可能存在这个 id。
  const [selectedByTab, setSelectedByTab] = useState<Record<string, string>>(
    () => ({ [initial.tab]: initial.selectedId }),
  );
  const [builderItemIds, setBuilderItemIds] = useState<string[]>(initial.itemIds);
  const searchRef = useRef<HTMLInputElement>(null);
  // 上一次写进地址栏的 (模块, 选中项)，用来把"真导航"和"敲搜索词"区分开
  const lastNavigationRef = useRef<{ tab: string; selectedId: string } | null>(null);
  const selectedId = selectedByTab[tab] ?? "";
  const setSelectedId = (id: string) => setSelectedByTab((current) => ({ ...current, [tab]: id }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onPopState = () => {
      const next = readAtlasState(window.location.search);
      setTab(next.tab);
      setQuery(next.query);
      setSelectedByTab((current) => ({ ...current, [next.tab]: next.selectedId }));
      setBuilderItemIds(next.itemIds);
      // 用户落到的地方现在就是"这里"，下面的 effect 不该把它当成一次新导航再压一条
      lastNavigationRef.current = { tab: next.tab, selectedId: next.selectedId };
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const champions = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    if (!needle) return data.champions;
    return data.champions.filter((champion) =>
      [champion.name, champion.epithet, champion.id, ...champion.tags_zh,
        ...champion.spells.flatMap((spell) => [spell.name, spell.description])]
        .join(" ").toLocaleLowerCase("zh-CN").includes(needle),
    );
  }, [data, query]);

  const selected = useMemo(
    () => champions.find((champion) => champion.key === selectedId) ?? champions[0] ?? null,
    [champions, selectedId],
  );

  // 英雄模块的选中项会回落到当前可见的第一条，地址栏写的是回落之后的结果，
  // 这样分享出去的链接打开就是同一屏。
  const visibleSelectedId = tab === "champions" && data ? (selected?.key ?? "") : selectedId;

  useEffect(() => {
    const url = writeAtlasState({ tab, query, selectedId: visibleSelectedId, itemIds: builderItemIds });
    // 打开模块、换记录算导航（留下可后退的历史）；搜索输入、配装增删只重写当前这一条，
    // 否则敲一个名字就会埋掉上一页。判定规则在 lib/atlas-url.mjs，有单测。
    const next = { tab, selectedId: visibleSelectedId };
    if (historyActionFor(lastNavigationRef.current, next) === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    lastNavigationRef.current = next;
  }, [builderItemIds, query, tab, visibleSelectedId]);

  useAtlasWebMcp({ tab, query, selectedId: visibleSelectedId, builderItemIds, setTab, setQuery, setSelectedId, setBuilderItemIds });

  const addBuilderItem = (id: string) => {
    setBuilderItemIds((current) => current.length >= MAX_LOADOUT_ITEMS ? current : [...current, id]);
  };

  return (
    <main className="atlas-shell">
      <header className="atlas-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><Database /></span>
          <div><p className="eyebrow">XSWT / DATA ARCHIVE</p><h1>LOL ATLAS</h1></div>
        </div>
        <label className="atlas-search">
          <Search aria-hidden="true" /><span className="sr-only">搜索图鉴</span>
          <Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索当前档案…" />
          <kbd>⌘/Ctrl K</kbd>
        </label>
        <div className="version-block">
          <span className="version-patch">{data ? `PATCH ${data.meta.version}` : "LOADING"}</span>
          <span className="version-site">
            <span className="status-dot" />
            <span>v{__APP_VERSION__}</span>
            {data?.meta.tx_version ? <span className="version-sep">tx {data.meta.tx_version}</span> : null}
            {data?.meta.built_at ? <span className="version-date">{data.meta.built_at.slice(0, 10)}</span> : null}
          </span>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="atlas-body">
        <AtlasNav dataVersion={data?.meta.version ?? null} />

        {tab === "champions" ? (
          <ChampionWorkspace champions={champions} selected={selected} onSelect={setSelectedId}
            loading={loading} error={error} timeline={data?.timeline} />
        ) : tab === "items" ? (
          <ItemWorkspace items={data?.items ?? []} query={query} selectedId={selectedId} onSelect={setSelectedId} onAdd={addBuilderItem} />
        ) : tab === "runes" ? (
          <RuneWorkspace trees={data?.trees ?? []} statMods={data?.stat_mods ?? []} query={query} selectedId={selectedId} onSelect={setSelectedId} />
        ) : tab === "summoner" ? (
          <SummonerWorkspace spells={data?.summoner ?? []} query={query} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <BuilderWorkspace itemIds={builderItemIds} items={data?.items ?? []}
            onRemove={(slot) => setBuilderItemIds((current) => current.filter((_, index) => index !== slot))}
            onClear={() => setBuilderItemIds([])} />
        )}
      </Tabs>
    </main>
  );
}

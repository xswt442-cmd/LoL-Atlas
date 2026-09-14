"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ChevronRight, Database, Gem, History, Search, Shield, Sparkles, Swords } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuilderWorkspace } from "@/components/atlas/builder-workspace";
import { ItemWorkspace } from "@/components/atlas/item-workspace";
import { RuneWorkspace } from "@/components/atlas/rune-workspace";
import { SummonerWorkspace } from "@/components/atlas/summoner-workspace";
import { Champion, loadLolData, LolData } from "@/lib/lol-data";

const navItems = [
  { value: "champions", label: "英雄", icon: Swords },
  { value: "items", label: "装备", icon: Shield },
  { value: "runes", label: "符文", icon: Gem },
  { value: "summoner", label: "召唤师技能", icon: Sparkles },
  { value: "builder", label: "配装", icon: Boxes },
] as const;

const statRows: Array<[keyof Champion, string]> = [
  ["hp", "生命"], ["attackdamage", "攻击力"], ["armor", "护甲"],
  ["spellblock", "魔抗"], ["attackspeed", "攻速"], ["attackrange", "射程"], ["movespeed", "移速"],
];

function readInitialState(search: string) {
  const params = new URLSearchParams(search);
  const requestedTab = params.get("tab");
  return {
    tab: navItems.some((item) => item.value === requestedTab) ? requestedTab! : "champions",
    query: params.get("q") ?? "",
    id: params.get("id") ?? "",
    itemIds: (params.get("b") ?? "").split(",").filter(Boolean).slice(0, 6),
  };
}

export function AtlasShell({ initialSearchParams }: { initialSearchParams: string }) {
  const [initial] = useState(() => readInitialState(initialSearchParams));
  const [data, setData] = useState<LolData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initial.tab);
  const [query, setQuery] = useState(initial.query);
  const [selectedId, setSelectedId] = useState(initial.id);
  const [builderItemIds, setBuilderItemIds] = useState<string[]>(initial.itemIds);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadLolData(controller.signal).then(setData).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "数据加载失败");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onPopState = () => {
      const next = readInitialState(window.location.search);
      setTab(next.tab);
      setQuery(next.query);
      setSelectedId(next.id);
      setBuilderItemIds(next.itemIds);
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
    () => data?.champions.find((champion) => champion.key === selectedId) ?? champions[0] ?? null,
    [champions, data, selectedId],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("v", "1");
    if (tab !== "champions") params.set("tab", tab);
    if (query) params.set("q", query);
    if (selectedId && tab !== "builder") params.set("id", selectedId);
    if (builderItemIds.length) params.set("b", builderItemIds.join(","));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [builderItemIds, query, selectedId, tab]);

  useAtlasWebMcp({ tab, query, selectedId, builderItemIds, setTab, setQuery, setSelectedId, setBuilderItemIds });

  const addBuilderItem = (id: string) => {
    setBuilderItemIds((current) => current.length >= 6 ? current : [...current, id]);
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
        <div className="version-chip"><span className="status-dot" />{data ? `PATCH ${data.meta.version}` : "LOADING"}</div>
      </header>

      <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="atlas-body">
        <aside className="atlas-nav">
          <TabsList variant="line" className="atlas-nav-list">
            {navItems.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="atlas-nav-item"><Icon aria-hidden="true" /><span>{label}</span></TabsTrigger>
            ))}
          </TabsList>
          <div className="archive-note"><History aria-hidden="true" /><span>数据快照</span><strong>{data?.meta.version ?? "—"}</strong></div>
        </aside>

        {tab === "champions" ? (
          <ChampionWorkspace champions={champions} selected={selected} onSelect={setSelectedId} loading={!data && !error} error={error} />
        ) : tab === "items" ? (
          <ItemWorkspace items={data?.items ?? []} query={query} selectedId={selectedId} onSelect={setSelectedId} onAdd={addBuilderItem} />
        ) : tab === "runes" ? (
          <RuneWorkspace trees={data?.trees ?? []} statMods={data?.stat_mods ?? []} query={query} selectedId={selectedId} onSelect={setSelectedId} />
        ) : tab === "summoner" ? (
          <SummonerWorkspace spells={data?.summoner ?? []} query={query} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <BuilderWorkspace itemIds={builderItemIds} items={data?.items ?? []}
            onRemove={(index) => setBuilderItemIds((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            onClear={() => setBuilderItemIds([])} />
        )}
      </Tabs>
    </main>
  );
}

type AtlasTab = (typeof navItems)[number]["value"];

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

function useAtlasWebMcp(state: {
  tab: string;
  query: string;
  selectedId: string;
  builderItemIds: string[];
  setTab: (tab: string) => void;
  setQuery: (query: string) => void;
  setSelectedId: (id: string) => void;
  setBuilderItemIds: (ids: string[]) => void;
}) {
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

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
          tab: { type: "string", enum: navItems.map((item) => item.value) },
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
        if (!navItems.some((item) => item.value === value.tab)) throw new Error("Unknown atlas tab");
        latest.current.setTab(value.tab as AtlasTab);
        if (typeof value.query === "string") latest.current.setQuery(value.query);
        if (typeof value.selectedId === "string") latest.current.setSelectedId(value.selectedId);
        return { tab: value.tab, query: value.query ?? latest.current.query, selectedId: value.selectedId ?? latest.current.selectedId };
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
        if (itemIds.length > 6 || itemIds.some((id) => typeof id !== "string" || !id)) throw new Error("Invalid itemIds");
        latest.current.setBuilderItemIds(itemIds as string[]);
        latest.current.setTab("builder");
        return { tab: "builder", itemIds };
      },
    });
    return () => lifecycle.abort();
  }, []);
}

function ChampionWorkspace({ champions, selected, onSelect, loading, error }: {
  champions: Champion[]; selected: Champion | null; onSelect: (id: string) => void; loading: boolean; error: string;
}) {
  return (
    <div className="champion-workspace">
      <section className="champion-index" aria-label="英雄列表">
        <div className="panel-heading"><div><span>CHAMPION INDEX</span><h2>英雄索引</h2></div><strong>{loading ? "—" : champions.length}</strong></div>
        <ScrollArea className="champion-scroll">
          {error ? <p className="state-message error">{error}</p> : null}
          {loading ? <p className="state-message">正在装载图鉴数据…</p> : null}
          {!loading && !error && champions.length === 0 ? <p className="state-message">没有找到匹配的英雄</p> : null}
          <div className="champion-list">
            {champions.map((champion) => (
              <button type="button" key={champion.key}
                className={champion.key === selected?.key ? "champion-row active" : "champion-row"}
                onClick={() => onSelect(champion.key)}>
                <img src={champion.icon} alt="" loading="lazy" />
                <span><strong>{champion.name}</strong><small>{champion.epithet}</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </section>
      <section className="champion-detail" aria-live="polite">{selected ? <ChampionDetail champion={selected} /> : null}</section>
    </div>
  );
}

function ChampionDetail({ champion }: { champion: Champion }) {
  return (
    <ScrollArea className="detail-scroll">
      <div className="detail-inner">
        <div className="champion-hero">
          <img src={champion.icon} alt={`${champion.name}头像`} />
          <div className="champion-title">
            <p>{champion.id.toUpperCase()} / {champion.key}</p><h2>{champion.name}</h2><span>{champion.epithet}</span>
            <div className="tag-row">
              {champion.tags_zh.map((tag) => <Badge key={tag}>{tag}</Badge>)}
              {[champion.tag_primary, champion.tag_secondary].filter(Boolean).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
            </div>
          </div>
          <div className="combat-note"><span>{champion.attack_type ?? "—"}</span><strong>{champion.damage_type ?? "未知伤害"}</strong><small>{champion.partype}</small></div>
        </div>
        <p className="champion-blurb">{champion.blurb}</p>
        <div className="stat-grid">
          {statRows.map(([key, label]) => <div key={key}><span>{label}</span><strong>{String(champion[key])}</strong></div>)}
        </div>
        <div className="section-label"><span>ABILITIES</span><strong>技能档案</strong></div>
        <div className="spell-stack">
          {champion.spells.map((spell) => (
            <article key={spell.slot} className="spell-card">
              <div className="spell-icon-wrap">{spell.icon_url ? <img src={spell.icon_url} alt="" loading="lazy" /> : null}<span>{spell.slot}</span></div>
              <div><header><h3>{spell.name}</h3><small>{spell.cooldown ? `CD ${spell.cooldown}` : "被动"}</small></header><p>{spell.description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

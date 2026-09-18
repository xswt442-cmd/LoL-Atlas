"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ChevronRight, Database, Gem, History, Search, Shield, Sparkles, Swords } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuilderWorkspace } from "@/components/atlas/builder-workspace";
import { ChampionDetail } from "@/components/atlas/champion-detail";
import { ItemWorkspace } from "@/components/atlas/item-workspace";
import { RuneWorkspace } from "@/components/atlas/rune-workspace";
import { SummonerWorkspace } from "@/components/atlas/summoner-workspace";
import { Champion, loadLolData, LolData, LolTimeline } from "@/lib/lol-data";
import { historyActionFor } from "@/lib/url-history.mjs";

const navItems = [
  { value: "champions", label: "英雄", icon: Swords },
  { value: "items", label: "装备", icon: Shield },
  { value: "runes", label: "符文", icon: Gem },
  { value: "summoner", label: "召唤师技能", icon: Sparkles },
  { value: "builder", label: "配装", icon: Boxes },
] as const;

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
  // One selection per module: switching tabs used to carry the previous id over,
  // which made the new module look up a record that cannot exist in it.
  const [selectedByTab, setSelectedByTab] = useState<Record<string, string>>(() => ({ [initial.tab]: initial.id }));
  const [championRole, setChampionRole] = useState<string | null>(null);
  const [builderItemIds, setBuilderItemIds] = useState<string[]>(initial.itemIds);
  const searchRef = useRef<HTMLInputElement>(null);
  // Last (tab, selection) pair written to the address bar, so the effect below
  // can tell a real navigation apart from a search keystroke.
  const lastNavigationRef = useRef<{ tab: string; selectedId: string } | null>(null);
  const selectedId = selectedByTab[tab] ?? "";
  const setSelectedId = (id: string) => setSelectedByTab((current) => ({ ...current, [tab]: id }));

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
      setSelectedByTab((current) => ({ ...current, [next.tab]: next.id }));
      setBuilderItemIds(next.itemIds);
      // Where the user landed is now "here" — the effect below must not treat it
      // as a fresh navigation and push another entry on top of it.
      lastNavigationRef.current = { tab: next.tab, selectedId: next.id };
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

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const champion of champions) {
      for (const tag of champion.tags_zh ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, [champions]);

  const visibleChampions = useMemo(
    () => (championRole
      ? champions.filter((champion) => (champion.tags_zh ?? []).includes(championRole))
      : champions),
    [championRole, champions],
  );

  const selected = useMemo(
    () => visibleChampions.find((champion) => champion.key === selectedId) ?? visibleChampions[0] ?? null,
    [selectedId, visibleChampions],
  );

  const visibleSelectedId = tab === "champions" && data ? (selected?.key ?? "") : selectedId;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("v", "1");
    if (tab !== "champions") params.set("tab", tab);
    if (query) params.set("q", query);
    if (visibleSelectedId && tab !== "builder") params.set("id", visibleSelectedId);
    if (builderItemIds.length) params.set("b", builderItemIds.join(","));
    const url = `?${params.toString()}`;

    // Opening a module or picking another record is a navigation: it earns a
    // history entry, so Back returns to the previous one. Search keystrokes and
    // loadout edits only rewrite the current entry — otherwise typing a name
    // would bury the previous page under a dozen entries. The rule itself lives
    // in lib/url-history.mjs so it can be tested.
    const next = { tab, selectedId: visibleSelectedId };
    if (historyActionFor(lastNavigationRef.current, next) === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    lastNavigationRef.current = next;
  }, [builderItemIds, query, tab, visibleSelectedId]);

  useAtlasWebMcp({ tab, query, selectedId: visibleSelectedId, builderItemIds, setTab, setQuery, setSelectedId, setBuilderItemIds });

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
        <aside className="atlas-nav">
          <TabsList variant="line" className="atlas-nav-list">
            {navItems.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="atlas-nav-item"><Icon aria-hidden="true" /><span>{label}</span></TabsTrigger>
            ))}
          </TabsList>
          <div className="archive-note"><History aria-hidden="true" /><span>数据快照</span><strong>{data?.meta.version ?? "—"}</strong></div>
        </aside>

        {tab === "champions" ? (
          <ChampionWorkspace champions={visibleChampions} selected={selected} onSelect={setSelectedId}
            championCount={champions.length} role={championRole} roleCounts={roleCounts} onRoleChange={setChampionRole}
            loading={!data && !error} error={error} timeline={data?.timeline} />
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
  // The tool handlers must see current values, so refresh on every render. A
  // dependency array here would just be a new object literal each time.
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

const roleOrder = ["战士", "坦克", "法师", "刺客", "射手", "辅助"];

function ChampionWorkspace({ champions, selected, onSelect, championCount, role, roleCounts, onRoleChange, loading, error, timeline }: {
  champions: Champion[]; selected: Champion | null; onSelect: (id: string) => void; loading: boolean;
  championCount: number; role: string | null; roleCounts: Map<string, number>;
  onRoleChange: (role: string | null) => void;
  error: string; timeline?: LolTimeline;
}) {
  const groupRefs = useRef(new Map<string, HTMLDivElement>());

  // 按中文名的拼音首字母分组，做成字母索引
  const groups = useMemo(() => {
    const map = new Map<string, Champion[]>();
    for (const champion of champions) {
      const key = champion.initial ?? "#";
      const bucket = map.get(key);
      if (bucket) bucket.push(champion);
      else map.set(key, [champion]);
    }
    return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [champions]);

  const jumpTo = (letter: string) => {
    const node = groupRefs.current.get(letter);
    if (node) node.scrollIntoView({ block: "start" });
  };

  return (
    <div className="champion-workspace">
      <section className="champion-index" aria-label="英雄列表">
        <div className="panel-heading">
          <div><span>CHAMPION INDEX</span><h2>英雄索引</h2></div>
          <strong>{loading ? "—" : champions.length}</strong>
        </div>
        {!loading && !error ? (
          <div className="role-strip" role="group" aria-label="按定位筛选">
            <button type="button" className={role === null ? "role-chip active" : "role-chip"}
              onClick={() => onRoleChange(null)}>全部<span>{championCount}</span></button>
            {roleOrder.map((entry) => (
              <button key={entry} type="button" className={role === entry ? "role-chip active" : "role-chip"}
                onClick={() => onRoleChange(entry)}>{entry}<span>{roleCounts.get(entry) ?? 0}</span></button>
            ))}
          </div>
        ) : null}
        {!loading && !error && groups.length > 1 ? (
          <div className="letter-rail" role="group" aria-label="按拼音首字母跳转">
            {groups.map(([letter, bucket]) => (
              <button key={letter} type="button" className="letter-chip"
                title={`${letter} · ${bucket.length}`} onClick={() => jumpTo(letter)}>{letter}</button>
            ))}
          </div>
        ) : null}
        <ScrollArea className="champion-scroll">
          {error ? <p className="state-message error">{error}</p> : null}
          {loading ? <p className="state-message">正在装载图鉴数据…</p> : null}
          {!loading && !error && champions.length === 0 ? <p className="state-message">没有找到匹配的英雄</p> : null}
          <div className="champion-list">
            {groups.map(([letter, bucket]) => (
              <div key={letter} className="champion-group"
                ref={(node) => {
                  if (node) groupRefs.current.set(letter, node);
                  else groupRefs.current.delete(letter);
                }}>
                <div className="champion-group-head"><span>{letter}</span><em>{bucket.length}</em></div>
                {bucket.map((champion) => (
                  <button type="button" key={champion.key}
                    className={champion.key === selected?.key ? "champion-row active" : "champion-row"}
                    onClick={() => onSelect(champion.key)}>
                    <img src={champion.icon} alt="" loading="lazy" />
                    <span>
                      <strong>{champion.name}<em>{champion.name_en}</em></strong>
                      <small>{champion.epithet}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
      <section className="champion-detail" aria-live="polite">
        {/* Keyed by champion so per-champion state — including the record of art
            that failed to load — never leaks from one hero to the next. */}
        {selected ? <ChampionDetail key={selected.id} champion={selected} timeline={timeline} /> : null}
      </section>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RuneTree, StatMod } from "@/lib/lol-data";

export function RuneWorkspace({ trees, statMods, query, selectedId, onSelect }: {
  trees: RuneTree[]; statMods: StatMod[]; query: string; selectedId: string; onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    if (!needle) return trees;
    return trees.filter((tree) => [tree.name, ...tree.slots.flat().flatMap((rune) => [rune.name, rune.long_desc])]
      .join(" ").toLocaleLowerCase("zh-CN").includes(needle));
  }, [query, trees]);
  const selected = trees.find((tree) => String(tree.id) === selectedId) ?? rows[0] ?? null;
  return <div className="catalog-workspace">
    <section className="catalog-index"><div className="panel-heading"><div><span>RUNE CODEX</span><h2>符文体系</h2></div><strong>{trees.length}</strong></div>
      <div className="tree-list">{rows.map((tree) => <button type="button" key={tree.id}
        className={tree.id === selected?.id ? "tree-row active" : "tree-row"} onClick={() => onSelect(String(tree.id))}>
        <img src={`https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`} alt="" /><span>{tree.name}</span>
      </button>)}</div>
    </section>
    <section className="catalog-detail"><ScrollArea className="detail-scroll">{selected ? <div className="detail-inner">
      <div className="record-hero rune-hero"><img src={`https://ddragon.leagueoflegends.com/cdn/img/${selected.icon}`} alt="" />
        <div><p>RUNE TREE / {selected.id}</p><h2>{selected.name}</h2><span>{selected.key}</span></div></div>
      <div className="rune-slots">{selected.slots.map((slot, index) => <section key={index}>
        <div className="section-label"><span>SLOT {index}</span><strong>{index === 0 ? "基石" : `第 ${index} 层`}</strong></div>
        <div className="rune-grid">{slot.map((rune) => <article className="rune-card" key={rune.id}>
          {rune.icon_url ? <img src={rune.icon_url} alt="" loading="lazy" /> : null}
          <div><header><h3>{rune.name}</h3><Badge variant="outline">{rune.desc_source}</Badge></header><p>{rune.long_desc || rune.short_desc}</p></div>
        </article>)}</div>
      </section>)}</div>
      <div className="section-label"><span>STAT MODS</span><strong>属性碎片</strong></div>
      <div className="mod-grid">{statMods.map((mod) => <div key={`${mod.row_no}-${mod.id}`}><img src={mod.icon_url} alt="" /><span><strong>{mod.name}</strong><small>{mod.stat}</small></span></div>)}</div>
    </div> : null}</ScrollArea></section>
  </div>;
}

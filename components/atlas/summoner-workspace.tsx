"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { SummonerSpell } from "@/lib/lol-types";

export function SummonerWorkspace({ spells, query, selectedId, onSelect }: {
  spells: SummonerSpell[]; query: string; selectedId: string; onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return needle ? spells.filter((spell) => `${spell.name} ${spell.description}`.toLocaleLowerCase("zh-CN").includes(needle)) : spells;
  }, [query, spells]);
  const selected = spells.find((spell) => spell.id === selectedId) ?? rows[0] ?? null;
  return <div className="catalog-workspace"><section className="catalog-index">
    <div className="panel-heading"><div><span>SUMMONER SPELLS</span><h2>召唤师技能</h2></div><strong>{rows.length}</strong></div>
    <div className="catalog-list">{rows.map((spell) => <button type="button" key={spell.id}
      className={spell.id === selected?.id ? "catalog-row active" : "catalog-row"} onClick={() => onSelect(spell.id)}>
      <img src={spell.icon} alt="" /><span><strong>{spell.name}</strong><small>冷却 {spell.cooldown} 秒</small></span><ChevronRight />
    </button>)}</div></section>
    <section className="catalog-detail">{selected ? <div className="detail-inner"><div className="record-hero">
      <img src={selected.icon} alt={`${selected.name}图标`} /><div><p>SUMMONER / {selected.id}</p><h2>{selected.name}</h2><span>召唤师等级 {selected.level} 解锁</span></div>
      <div className="cooldown-dial"><strong>{selected.cooldown}</strong><span>SECONDS</span></div></div>
      <p className="champion-blurb large-copy">{selected.description}</p></div> : null}</section>
  </div>;
}

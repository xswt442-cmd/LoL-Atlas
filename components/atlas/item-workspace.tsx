"use client";

import { useMemo, useState } from "react";
import { ChevronRight, PackagePlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Item, itemStatFields } from "@/lib/lol-data";

export function ItemWorkspace({ items, query, selectedId, onSelect, onAdd }: {
  items: Item[];
  query: string;
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const [category, setCategory] = useState("全部");
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(items.flatMap((item) => item.categories)))],
    [items],
  );
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return items.filter((item) => {
      if (category !== "全部" && !item.categories.includes(category)) return false;
      if (!needle) return true;
      return [item.name, item.id, item.description, ...item.tags_zh, ...item.categories]
        .join(" ").toLocaleLowerCase("zh-CN").includes(needle);
    });
  }, [category, items, query]);
  const selected = items.find((item) => item.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="catalog-workspace">
      <section className="catalog-index">
        <div className="panel-heading"><div><span>ITEM ARCHIVE</span><h2>装备档案</h2></div><strong>{rows.length}</strong></div>
        <div className="filter-strip" aria-label="装备分类">
          {categories.map((value) => (
            <button key={value} type="button" className={category === value ? "filter-chip active" : "filter-chip"}
              onClick={() => setCategory(value)}>{value}</button>
          ))}
        </div>
        <ScrollArea className="catalog-scroll">
          <div className="catalog-list">
            {rows.map((item) => (
              <button type="button" key={item.id} className={item.id === selected?.id ? "catalog-row active" : "catalog-row"}
                onClick={() => onSelect(item.id)}>
                <img src={item.icon} alt="" loading="lazy" />
                <span><strong>{item.name}</strong><small>{item.gold_total ? `${item.gold_total} 金` : "免费"} · {item.tier}</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </section>
      <section className="catalog-detail">
        <ScrollArea className="detail-scroll">
          {selected ? <ItemDetail item={selected} items={items} onAdd={onAdd} /> : <p className="state-message">没有匹配的装备</p>}
        </ScrollArea>
      </section>
    </div>
  );
}

function ItemDetail({ item, items, onAdd }: { item: Item; items: Item[]; onAdd: (id: string) => void }) {
  const stats = itemStatFields.filter(([key]) => item[key]);
  const components = item.components.map((component) => ({
    ...component,
    item: items.find((candidate) => candidate.id === component.id),
  }));
  const upgrades = item.builds_into.map((id) => items.find((candidate) => candidate.id === id)).filter(Boolean) as Item[];
  return (
    <div className="detail-inner">
      <div className="record-hero">
        <img src={item.icon} alt={`${item.name}图标`} />
        <div><p>ITEM / {item.id}</p><h2>{item.name}</h2><span>{item.plaintext}</span>
          <div className="tag-row">{item.categories.map((value) => <Badge key={value}>{value}</Badge>)}<Badge variant="outline">{item.tier}</Badge></div>
        </div>
        <Button onClick={() => onAdd(item.id)}><PackagePlus />加入配装</Button>
      </div>
      <div className="price-block"><span>总价</span><strong>{item.gold_total || 0}</strong><small>售出 {item.gold_sell || 0}</small></div>
      {stats.length ? <div className="stat-grid item-stats">{stats.map(([key, label]) => <div key={key}><span>{label}</span><strong>{item[key]}</strong></div>)}</div> : null}
      <p className="champion-blurb">{item.description}</p>
      <div className="recipe-grid">
        <RecipeColumn title="合成组件" empty="无需组件" rows={components.map(({ item: component, qty }) => ({
          id: component?.id ?? "", icon: component?.icon, name: component?.name ?? "未知组件", meta: qty > 1 ? `× ${qty}` : `${component?.gold_total ?? 0} 金`,
        }))} onSelect={onAdd} actionLabel="加入" />
        <RecipeColumn title="可合成" empty="暂无后续装备" rows={upgrades.map((upgrade) => ({ id: upgrade.id, icon: upgrade.icon, name: upgrade.name, meta: `${upgrade.gold_total} 金` }))} />
      </div>
    </div>
  );
}

function RecipeColumn({ title, empty, rows, onSelect, actionLabel }: {
  title: string; empty: string; rows: Array<{ id: string; icon?: string; name: string; meta: string }>;
  onSelect?: (id: string) => void; actionLabel?: string;
}) {
  return <section className="recipe-column"><div className="section-label"><span>BUILD PATH</span><strong>{title}</strong></div>
    {rows.length ? rows.map((row) => <div className="recipe-row" key={row.id}>
      {row.icon ? <img src={row.icon} alt="" /> : null}<span><strong>{row.name}</strong><small>{row.meta}</small></span>
      {onSelect ? <Button variant="ghost" size="sm" onClick={() => onSelect(row.id)}>{actionLabel}</Button> : null}
    </div>) : <p className="muted-copy">{empty}</p>}
  </section>;
}

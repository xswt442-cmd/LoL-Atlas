"use client";

import { Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Item, itemStatFields } from "@/lib/lol-data";

export function BuilderWorkspace({ itemIds, items, onRemove, onClear }: {
  itemIds: string[]; items: Item[]; onRemove: (index: number) => void; onClear: () => void;
}) {
  const selected = itemIds.map((id) => items.find((item) => item.id === id)).filter(Boolean) as Item[];
  const total = selected.reduce((sum, item) => sum + item.gold_total, 0);
  const sums = Object.fromEntries(itemStatFields.map(([key]) => [key, selected.reduce((sum, item) => sum + item[key], 0)]));
  const copyLink = async () => navigator.clipboard.writeText(window.location.href);
  return <section className="builder-workspace"><div className="builder-heading"><div><span>LOADOUT CALCULATOR</span><h2>配装实验台</h2>
    <p>允许重复装备；方案会同步到当前网址。</p></div><div className="builder-actions">
      <Button variant="outline" onClick={copyLink}><Copy />复制链接</Button>
      <Button variant="destructive" onClick={onClear} disabled={!selected.length}><Trash2 />清空</Button>
    </div></div>
    {!selected.length ? <div className="builder-empty"><PackageGlyph /><h3>还没有装备</h3><p>从装备详情加入物品，这里会实时汇总价格与属性。</p></div> : <>
      <div className="builder-summary"><div><span>装备数量</span><strong>{selected.length}<small> / 6</small></strong></div><div><span>总价</span><strong>{total}<small> 金</small></strong></div></div>
      <div className="builder-grid">{selected.map((item, index) => <article key={`${item.id}-${index}`}>
        <img src={item.icon} alt="" /><div><strong>{item.name}</strong><span>{item.gold_total} 金 · {item.tier}</span></div>
        <button type="button" aria-label={`移除${item.name}`} onClick={() => onRemove(index)}><X /></button>
      </article>)}</div>
      <div className="section-label"><span>AGGREGATE</span><strong>属性汇总</strong></div>
      <div className="stat-grid item-stats">{itemStatFields.filter(([key]) => sums[key]).map(([key, label]) => <div key={key}><span>{label}</span><strong>{sums[key]}</strong></div>)}</div>
    </>}
  </section>;
}

function PackageGlyph() {
  return <div className="package-glyph" aria-hidden="true"><span /><span /><span /></div>;
}

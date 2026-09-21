"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itemStatFields, type Item } from "@/lib/lol-types";

export function BuilderWorkspace({ itemIds, items, onRemove, onClear }: {
  itemIds: string[]; items: Item[]; onRemove: (slot: number) => void; onClear: () => void;
}) {
  // Keep the position each occupant had in `itemIds`: unresolved ids (a link
  // shared from an older patch) must not shift the slots, or removing one
  // loadout entry would delete a different one.
  const occupants = itemIds
    .map((id, slot) => ({ slot, item: items.find((item) => item.id === id) }))
    .filter((entry): entry is { slot: number; item: Item } => Boolean(entry.item));
  const selected = occupants.map((entry) => entry.item);
  const total = selected.reduce((sum, item) => sum + item.gold_total, 0);
  const sums = Object.fromEntries(itemStatFields.map(([key]) => [key, selected.reduce((sum, item) => sum + item[key], 0)]));
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
  };
  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 2400);
    return () => clearTimeout(timer);
  }, [copied]);
  const copyLabel = copied === "ok" ? "已复制" : copied === "error" ? "复制失败" : "复制链接";
  return <section className="builder-workspace"><div className="builder-heading"><div><span>LOADOUT CALCULATOR</span><h2>配装实验台</h2>
    <p>允许重复装备；方案会同步到当前网址。</p></div><div className="builder-actions">
      <Button variant="outline" onClick={copyLink} aria-live="polite">
        {copied === "ok" ? <Check /> : <Copy />}{copyLabel}
      </Button>
      <Button variant="destructive" onClick={onClear} disabled={!selected.length}><Trash2 />清空</Button>
    </div></div>
    {!selected.length ? <div className="builder-empty"><PackageGlyph /><h3>还没有装备</h3><p>从装备详情加入物品，这里会实时汇总价格与属性。</p></div> : <>
      <div className="builder-summary"><div><span>装备数量</span><strong>{selected.length}<small> / 6</small></strong></div><div><span>总价</span><strong>{total}<small> 金</small></strong></div></div>
      <div className="builder-grid">{occupants.map(({ slot, item }) => <article key={slot}>
        <img src={item.icon} alt="" /><div><strong>{item.name}</strong><span>{item.gold_total} 金 · {item.tier}</span></div>
        <button type="button" aria-label={`移除${item.name}`} onClick={() => onRemove(slot)}><X /></button>
      </article>)}</div>
      <div className="section-label"><span>AGGREGATE</span><strong>属性汇总</strong></div>
      <div className="stat-grid item-stats">{itemStatFields.filter(([key]) => sums[key]).map(([key, label]) => <div key={key}><span>{label}</span><strong>{sums[key]}</strong></div>)}</div>
    </>}
  </section>;
}

function PackageGlyph() {
  return <div className="package-glyph" aria-hidden="true"><span /><span /><span /></div>;
}

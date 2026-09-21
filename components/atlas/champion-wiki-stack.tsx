import type { WikiAbility, WikiChampion } from "@/lib/lol-types";

const wikiSlots = ["P", "Q", "W", "E", "R"] as const;

/**
 * 英文原案技能栈（lolwiki 副源）。
 *
 * 与中文技能卡是两套独立呈现：数值网格、机制属性、机制备注在中文 CDN 源里都没有
 * 对应项，所以这里不做逐字段混排，缺数据就留空，不拿中文内容顶替。
 */
export function WikiSpellStack({ wiki }: { wiki: WikiChampion }) {
  // 按 slot 分组而不是 slot→单条：一个英雄若在同一 slot 下挂了两个条目，
  // 用 Map 会让前面的静默消失。当前数据没有这种情况，但那是个不会报错的失败。
  const bySlot = new Map<string, WikiAbility[]>();
  for (const ability of wiki.abilities) {
    if (!ability.slot) continue;
    const group = bySlot.get(ability.slot);
    if (group) group.push(ability);
    else bySlot.set(ability.slot, [ability]);
  }

  return (
    <div className="wiki-stack">
      {wikiSlots.flatMap((slot) => (bySlot.get(slot) ?? []).map((ability, index) => {
        const stats = Object.entries(ability.stats ?? {});
        const attrs = Object.entries(ability.attrs ?? {});
        return (
          <article key={`${slot}-${index}`} className="wiki-card">
            <div className="wiki-card-head">
              <span className="wiki-slot">{slot}</span>
              <h3>{ability.name}</h3>
              {ability.type ? <small>{ability.type}</small> : null}
            </div>
            {ability.description ? <p className="wiki-desc">{ability.description}</p> : null}
            {ability.flavor ? <p className="wiki-flavor">{ability.flavor}</p> : null}
            {stats.length ? (
              <dl className="wiki-stats">
                {stats.map(([label, value]) => (
                  <div key={label} className="wiki-stat"><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            ) : null}
            {attrs.length ? (
              <ul className="wiki-attrs">
                {attrs.map(([label, value]) => (
                  <li key={label}><b>{label}</b><span>{value}</span></li>
                ))}
              </ul>
            ) : null}
            {ability.notes.length ? (
              <ul className="wiki-notes">
                {ability.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : null}
          </article>
        );
      }))}
    </div>
  );
}

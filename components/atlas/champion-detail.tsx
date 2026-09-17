"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Champion, loadChampionWiki, LolTimeline, Playstyle, WikiChampion } from "@/lib/lol-data";

const CDN = "https://ddragon.leagueoflegends.com/cdn/img/champion";

const statRows: Array<[keyof Champion, string]> = [
  ["hp", "生命"], ["attackdamage", "攻击力"], ["armor", "护甲"],
  ["spellblock", "魔抗"], ["attackspeed", "攻速"], ["attackrange", "射程"], ["movespeed", "移速"],
];

/** 版本改动里出现的字段名 → 中文标签 */
const statLabels: Record<string, string> = {
  hp: "生命", hp_per_level: "成长生命", hpregen: "生命回复", hpregen_per_level: "成长生命回复",
  mp: "法力", mp_per_level: "成长法力", mpregen: "法力回复", mpregen_per_level: "成长法力回复",
  armor: "护甲", armor_per_level: "成长护甲", spellblock: "魔抗", spellblock_per_level: "成长魔抗",
  attackdamage: "攻击力", attackdamage_per_level: "成长攻击力",
  attackspeed: "攻速", attackspeed_per_level: "成长攻速",
  attackrange: "射程", movespeed: "移速", crit: "暴击", crit_per_level: "成长暴击",
};

const wikiSlots = ["P", "Q", "W", "E", "R"] as const;

const versionValue = (version: string) => version.split(".").map((part) => Number.parseInt(part, 10));

/** 官方五维玩法评分（0-3）画成五边形雷达 */
function PlaystyleRadar({ playstyle }: { playstyle: Playstyle }) {
  const dims: Array<[keyof Playstyle, string]> = [
    ["damage", "伤害"], ["durability", "耐久"], ["crowdControl", "控制"],
    ["mobility", "机动"], ["utility", "功能"],
  ];
  const cx = 92, cy = 86, r = 54, max = 3;
  const at = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / dims.length - Math.PI / 2;
    const radius = (Math.max(0, Math.min(max, value)) / max) * r;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  };
  const ring = (level: number) => dims.map((_, index) => at(index, level).join(",")).join(" ");
  const shape = dims.map(([key], index) => at(index, playstyle[key]).join(",")).join(" ");
  return (
    <figure className="radar">
      <svg viewBox="0 0 184 172" role="img" aria-label="玩法评分雷达图">
        {[1, 2, 3].map((level) => <polygon key={level} points={ring(level)} className="radar-ring" />)}
        {dims.map(([, label], index) => {
          const [x, y] = at(index, max);
          return <line key={label} x1={cx} y1={cy} x2={x} y2={y} className="radar-spoke" />;
        })}
        <polygon points={shape} className="radar-shape" />
        {dims.map(([key, label], index) => {
          const [x, y] = at(index, max * 1.26);
          return (
            <text key={label} x={x} y={y} className="radar-label"
              textAnchor={x > cx + 6 ? "start" : x < cx - 6 ? "end" : "middle"}
              dominantBaseline="central">{label} {playstyle[key]}</text>
          );
        })}
      </svg>
      <figcaption>官方五维玩法评分</figcaption>
    </figure>
  );
}

/** 版本改动：逐版本列出字段的 旧值 → 新值 */
function PatchHistory({ changes }: { changes: LolTimeline["champions"][string] }) {
  const ordered = [...changes].sort((a, b) => {
    const left = versionValue(a.v), right = versionValue(b.v);
    for (let i = 0; i < 3; i += 1) {
      if ((right[i] ?? 0) !== (left[i] ?? 0)) return (right[i] ?? 0) - (left[i] ?? 0);
    }
    return 0;
  });
  return (
    <ol className="timeline">
      {ordered.map((entry) => (
        <li key={entry.v} className="timeline-row">
          <span className="timeline-version">{entry.v}</span>
          <ul className="timeline-fields">
            {Object.entries(entry.c).map(([field, pair]) => (
              <li key={field}>
                <span className="timeline-field">{statLabels[field] ?? field}</span>
                <b className="timeline-from">{pair[0]}</b>
                <i aria-hidden="true">→</i>
                <b className="timeline-to">{pair[1]}</b>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * 英文原案技能栈（lolwiki 副源）。
 *
 * 与中文技能卡是两套独立呈现：数值网格、机制属性、机制备注在中文 CDN 源里都没有
 * 对应项，所以这里不做逐字段混排，缺数据就留空，不拿中文内容顶替。
 */
export function WikiSpellStack({ wiki }: { wiki: WikiChampion }) {
  const bySlot = new Map(wiki.abilities.filter((ability) => ability.slot).map((ability) => [ability.slot, ability]));
  return (
    <div className="wiki-stack">
      {wikiSlots.map((slot) => {
        const ability = bySlot.get(slot);
        if (!ability) return null;
        const stats = Object.entries(ability.stats ?? {});
        const attrs = Object.entries(ability.attrs ?? {});
        return (
          <article key={slot} className="wiki-card">
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
      })}
    </div>
  );
}

export function ChampionDetail({ champion, timeline }: {
  champion: Champion; timeline?: LolTimeline;
}) {
  const [showWiki, setShowWiki] = useState(false);
  // `undefined` = not fetched yet, `null` = this champion has no wiki entry.
  const [wiki, setWiki] = useState<WikiChampion | null | undefined>(undefined);
  const [wikiFailed, setWikiFailed] = useState(false);
  // Loaded on demand: the wiki is 58% of the snapshot and only renders behind
  // this switch, so it is fetched per champion instead of shipped to everyone.
  useEffect(() => {
    if (!showWiki || wiki !== undefined || wikiFailed) return;
    const controller = new AbortController();
    loadChampionWiki(champion.key, controller.signal)
      .then(setWiki)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setWikiFailed(true);
      });
    return () => controller.abort();
  }, [champion.key, showWiki, wiki, wikiFailed]);
  const wikiLoading = showWiki && wiki === undefined && !wikiFailed;
  // 加载失败的图用状态记账，绝不把 <figure> 从 DOM 里 remove 掉。
  // 命令式 remove 会让 React 的 fiber 树和真实 DOM 脱节，之后任何一次提交只要
  // 需要卸载那个节点，就会抛 "Failed to execute 'removeChild' on 'Node'" 把页面打崩。
  // 状态键里带上英雄 id，切英雄时自动失效，不会把上一个英雄的失败状态带过来。
  const [brokenArt, setBrokenArt] = useState<Record<string, true>>({});
  const markBroken = (key: string) => setBrokenArt((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const wikiMode = showWiki && Boolean(wiki);
  const skins = (champion.skins ?? []).filter((skin) => skin.num > 0);
  const heroKey = `${champion.id}:hero`;
  const visibleSkins = skins.filter((skin) => !brokenArt[`${champion.id}:${skin.num}`]);
  const changes = timeline?.champions?.[champion.key] ?? [];
  const trivia = wikiMode ? (wiki?.trivia ?? []) : [];

  return (
    <ScrollArea className="detail-scroll">
      <div className="detail-inner">
        <div className="champion-hero">
          {!brokenArt[heroKey] ? (
            <img className="hero-splash" src={`${CDN}/splash/${champion.id}_0.jpg`} alt=""
              onError={() => markBroken(heroKey)} />
          ) : null}
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-body">
            <img className="hero-icon" src={champion.icon} alt={`${champion.name}头像`} />
            <div className="champion-title">
              <p>{champion.id.toUpperCase()} / {champion.key}</p>
              <h2>{champion.name}</h2>
              <span>{champion.epithet}{champion.name_en ? ` · ${champion.name_en}` : ""}</span>
              <div className="tag-row">
                {champion.tags_zh.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                {[champion.tag_primary, champion.tag_secondary].filter(Boolean).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
              </div>
            </div>
            <div className="combat-note">
              <span>{champion.attack_type ?? "—"}</span>
              <strong>{champion.damage_type ?? "未知伤害"}</strong>
              <small>{champion.partype}</small>
            </div>
          </div>
        </div>

        <p className="champion-blurb">
          {wikiMode && champion.blurb_en ? champion.blurb_en : champion.blurb}
        </p>
        {wikiMode ? (
          <p className="source-badge">
            <span className="source-badge-dot" aria-hidden="true" />
            简介与技能均取自 lolwiki 英文原案
          </p>
        ) : null}

        <div className="champion-overview">
          <div className="stat-grid">
            {statRows.map(([key, label]) => (
              <div key={key}><span>{label}</span><strong>{String(champion[key])}</strong></div>
            ))}
          </div>
          {champion.playstyle ? <PlaystyleRadar playstyle={champion.playstyle} /> : null}
        </div>

        <div className="section-label">
          <span>{wikiMode ? "LOLWIKI / EN" : "ABILITIES"}</span>
          <strong>{wikiMode ? "英文原案" : "技能档案"}</strong>
          {wikiLoading ? <em className="section-count">正在加载英文原案…</em> : null}
          {wikiFailed ? <em className="section-count">英文原案加载失败</em> : null}
          {wiki !== null ? (
            <button type="button" className="source-toggle" onClick={() => setShowWiki((value) => !value)}>
              {wikiMode ? "← 中文（CDN）" : "EN 原案 (lolwiki) →"}
            </button>
          ) : null}
        </div>
        {wikiMode && wiki ? <WikiSpellStack wiki={wiki} /> : (
          <div className="spell-stack">
            {champion.spells.map((spell) => (
              <article key={spell.slot} className="spell-card">
                <div className="spell-icon-wrap">{spell.icon_url ? <img src={spell.icon_url} alt="" loading="lazy" /> : null}<span>{spell.slot}</span></div>
                <div><header><h3>{spell.name}</h3><small>{spell.cooldown ? `CD ${spell.cooldown}` : "被动"}</small></header><p>{spell.description}</p></div>
              </article>
            ))}
          </div>
        )}
        {wikiMode ? <p className="source-note">数值网格与机制备注来自 lolwiki 英文原案，中文 CDN 源没有这两项；无对应数据时留空，不拿中文内容顶替。</p> : null}

        {trivia.length ? (
          <>
            <div className="section-label">
              <span>TRIVIA</span><strong>趣闻</strong><em className="section-count">{trivia.length}</em>
            </div>
            <ul className="trivia-list">
              {trivia.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </>
        ) : null}

        {changes.length ? (
          <>
            <div className="section-label">
              <span>PATCH HISTORY</span><strong>版本改动</strong><em className="section-count">{changes.length}</em>
            </div>
            <PatchHistory changes={changes} />
          </>
        ) : null}

        {/* Gate on what survived loading, otherwise a hero whose art all 404s
            leaves an empty section heading behind. */}
        {visibleSkins.length ? (
          <>
            <div className="section-label">
              <span>SKINS</span><strong>皮肤</strong><em className="section-count">{skins.length}</em>
            </div>
            <div className="skin-grid">
              {visibleSkins.map((skin) => (
                <figure key={`${champion.id}-${skin.num}`} className="skin-card">
                  <img src={`${CDN}/loading/${champion.id}_${skin.num}.jpg`} alt="" loading="lazy"
                    onError={() => markBroken(`${champion.id}:${skin.num}`)} />
                  <figcaption>
                    {skin.name}
                    {skin.chroma_count ? <em>+{skin.chroma_count}</em> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </ScrollArea>
  );
}

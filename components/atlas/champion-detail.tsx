"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChampionStatPanel } from "@/components/atlas/champion-stat-panel";
import { PatchHistory } from "@/components/atlas/champion-patch-history";
import { PlaystyleRadar } from "@/components/atlas/champion-playstyle-radar";
import { WikiSpellStack } from "@/components/atlas/champion-wiki-stack";
import { useBrokenArt } from "@/hooks/use-broken-art";
import { useChampionWiki } from "@/hooks/use-champion-wiki";
import { championLoadingUrl, championSplashUrl } from "@/lib/ddragon";
import type { Champion, LolTimeline } from "@/lib/lol-types";

/**
 * 英雄详情：中文 CDN 数据为主，可切到 lolwiki 英文原案。
 *
 * 数据来源的切换只影响简介与技能两处；数值属性、版本改动、皮肤始终来自 CDN 主源。
 */
export function ChampionDetail({ champion, timeline, level, onLevelChange }: {
  champion: Champion; timeline?: LolTimeline; level: number; onLevelChange: (level: number) => void;
}) {
  const [showWiki, setShowWiki] = useState(false);
  const { wiki, loading: wikiLoading, failed: wikiFailed } = useChampionWiki(champion.key, showWiki);
  const { isBroken, markBroken } = useBrokenArt();

  const wikiMode = showWiki && Boolean(wiki);
  const skins = (champion.skins ?? []).filter((skin) => skin.num > 0);
  const visibleSkins = skins.filter((skin) => !isBroken(`${champion.id}:${skin.num}`));
  const changes = timeline?.champions?.[champion.key] ?? [];
  const trivia = wikiMode ? (wiki?.trivia ?? []) : [];

  return (
    <ScrollArea className="detail-scroll">
      <div className="detail-inner">
        <div className="champion-hero">
          {!isBroken(`${champion.id}:hero`) ? (
            <img className="hero-splash" src={championSplashUrl(champion.id)} alt=""
              onError={() => markBroken(`${champion.id}:hero`)} />
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
          <ChampionStatPanel champion={champion} level={level} onLevelChange={onLevelChange} />
          {champion.playstyle ? <PlaystyleRadar playstyle={champion.playstyle} /> : null}
        </div>

        <div className="section-label">
          <span>{wikiMode ? "LOLWIKI / EN" : "ABILITIES"}</span>
          <strong>{wikiMode ? "英文原案" : "技能档案"}</strong>
          {wikiLoading ? <em className="section-count">正在加载英文原案…</em> : null}
          {wikiFailed ? <em className="section-count">英文原案加载失败</em> : null}
          {/* 这个英雄没有原案条目（404）时不给开关，避免点开一片空白 */}
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

        {/* 按"实际加载成功的图"决定是否出这一段，否则原画全 404 的英雄会只剩一个空标题 */}
        {visibleSkins.length ? (
          <>
            <div className="section-label">
              <span>SKINS</span><strong>皮肤</strong><em className="section-count">{skins.length}</em>
            </div>
            <div className="skin-grid">
              {visibleSkins.map((skin) => (
                <figure key={`${champion.id}-${skin.num}`} className="skin-card">
                  <img src={championLoadingUrl(champion.id, skin.num)} alt="" loading="lazy"
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

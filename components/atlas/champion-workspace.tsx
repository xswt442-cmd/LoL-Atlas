"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ChampionDetail } from "@/components/atlas/champion-detail";
import type { Champion, LolTimeline } from "@/lib/lol-types";

/** 定位筛选的固定顺序：按玩家习惯排，而不是按数据里出现的顺序 */
const roleOrder = ["战士", "坦克", "法师", "刺客", "射手", "辅助"];

/**
 * 英雄模块：左侧索引（定位筛选 + 拼音首字母跳转）+ 右侧详情。
 *
 * 定位筛选与计数留在本组件内 —— 只有它用得到，之前放在外层导致外层要替它算
 * 计数、过滤列表，再连同"总数"一起当 props 递进来。
 *
 * `selected` 仍由外层解析：选中项会写进地址栏，属于页面级状态。
 * 但选中的英雄可能被定位筛掉，这时本组件退回该定位下的第一条用于展示。
 */
export function ChampionWorkspace({ champions, selected, onSelect, loading, error, timeline }: {
  champions: Champion[];
  selected: Champion | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string;
  timeline?: LolTimeline;
}) {
  const [role, setRole] = useState<string | null>(null);
  // 等级放在这里而不是详情组件里：详情按英雄加了 key，状态放那儿会在切英雄时被重置，
  // 而"我想看 11 级的数据"是跨英雄的浏览意图。
  const [level, setLevel] = useState(1);
  const groupRefs = useRef(new Map<string, HTMLDivElement>());

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const champion of champions) {
      for (const tag of champion.tags_zh ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, [champions]);

  const visible = useMemo(
    () => (role ? champions.filter((champion) => (champion.tags_zh ?? []).includes(role)) : champions),
    [champions, role],
  );

  const shown = useMemo(
    () => visible.find((champion) => champion.key === selected?.key) ?? visible[0] ?? null,
    [selected, visible],
  );

  // 按中文名的拼音首字母分组，做成字母索引
  const groups = useMemo(() => {
    const map = new Map<string, Champion[]>();
    for (const champion of visible) {
      const key = champion.initial ?? "#";
      const bucket = map.get(key);
      if (bucket) bucket.push(champion);
      else map.set(key, [champion]);
    }
    return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [visible]);

  const jumpTo = (letter: string) => {
    const node = groupRefs.current.get(letter);
    if (node) node.scrollIntoView({ block: "start" });
  };

  const idle = !loading && !error;

  return (
    <div className="champion-workspace">
      <section className="champion-index" aria-label="英雄列表">
        <div className="panel-heading">
          <div><span>CHAMPION INDEX</span><h2>英雄索引</h2></div>
          <strong>{loading ? "—" : visible.length}</strong>
        </div>
        {idle ? (
          <div className="role-strip" role="group" aria-label="按定位筛选">
            <button type="button" className={role === null ? "role-chip active" : "role-chip"}
              onClick={() => setRole(null)}>全部<span>{champions.length}</span></button>
            {roleOrder.map((entry) => (
              <button key={entry} type="button" className={role === entry ? "role-chip active" : "role-chip"}
                onClick={() => setRole(entry)}>{entry}<span>{roleCounts.get(entry) ?? 0}</span></button>
            ))}
          </div>
        ) : null}
        {idle && groups.length > 1 ? (
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
          {idle && visible.length === 0 ? <p className="state-message">没有找到匹配的英雄</p> : null}
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
                    className={champion.key === shown?.key ? "champion-row active" : "champion-row"}
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
        {/* 按英雄加 key：每个英雄的局部状态（含"哪张图加载失败"的记账）不会串到下一个英雄 */}
        {shown ? (
          <ChampionDetail key={shown.id} champion={shown} timeline={timeline} level={level} onLevelChange={setLevel} />
        ) : null}
      </section>
    </div>
  );
}

"use client";

import {
  bonusAttackSpeedPercent,
  FIXED_STATS,
  LEVEL_SCALED_STATS,
  MAX_LEVEL,
  MIN_LEVEL,
  UNIT_RADIUS_STATS,
  valueAtLevel,
} from "@/lib/champion-stats.mjs";
import type { Champion } from "@/lib/lol-types";

/** 去掉多余的尾随零：2768.82 保留，1800.60 写成 1800.6 */
const format = (value: number, digits: number) => `${Number(value.toFixed(digits))}`;

const readNumber = (champion: Champion, key: string): number | undefined => {
  const value = champion[key as keyof Champion];
  return typeof value === "number" ? value : undefined;
};

/**
 * 基础数值面板：一根等级滑块 + 各级数值。
 *
 * 比 lolwiki 多的那一列是「成长/级」—— 它只给 1 级到满级的区间，看得出来结果却看不出每级
 * 涨多少，而成长值本身才是判断"这个英雄前中期强不强"的依据。
 *
 * 「满级」列固定按 20 级算（常规对局 18 级，任务模式放宽到 20）。等级状态由外层持有，
 * 切英雄时不重置。
 */
export function ChampionStatPanel({ champion, level, onLevelChange }: {
  champion: Champion;
  level: number;
  onLevelChange: (level: number) => void;
}) {
  const rows = LEVEL_SCALED_STATS.flatMap((descriptor) => {
    const base = readNumber(champion, descriptor.base);
    if (base === undefined) return [];
    const growth = descriptor.growth === undefined ? null : readNumber(champion, descriptor.growth) ?? 0;
    return [{
      descriptor,
      base,
      growth,
      // 攻速的成长值单位是百分比，加个 % 才不会被读成绝对攻速
      growthLabel: growth === null ? "—"
        : descriptor.kind === "attackspeed" ? `+${format(growth, 2)}%` : `+${format(growth, 2)}`,
      current: valueAtLevel(champion, descriptor, level),
      maximum: valueAtLevel(champion, descriptor, MAX_LEVEL),
      bonus: descriptor.kind === "attackspeed" && growth !== null
        ? bonusAttackSpeedPercent(growth, level)
        : null,
    }];
  });

  const extras = [
    {
      title: "不随等级变化",
      rows: FIXED_STATS.flatMap((entry) => {
        const value = readNumber(champion, entry.key);
        if (value === undefined) return [];
        // 攻速比率 0 表示这个英雄不走常规攻速缩放（烬），照 lolwiki 写 N/A
        const shown = entry.key === "attackspeed_ratio" && value === 0
          ? "N/A"
          : entry.percent ? `${format(value * 100, 0)}%` : format(value, entry.digits ?? 0);
        return [{ key: entry.key, label: entry.label, shown }];
      }),
    },
    {
      title: "单位几何",
      rows: UNIT_RADIUS_STATS.flatMap((entry) => {
        const value = readNumber(champion, entry.key);
        return value === undefined ? [] : [{ key: entry.key, label: entry.label, shown: format(value, 2) }];
      }),
    },
  ];

  return (
    <section className="stat-panel">
      <div className="level-control">
        <label htmlFor="champion-level"><span>LEVEL</span><strong>{level}</strong></label>
        <input
          id="champion-level"
          type="range"
          min={MIN_LEVEL}
          max={MAX_LEVEL}
          step={1}
          value={level}
          aria-label={`等级 ${level}（${MIN_LEVEL} 到 ${MAX_LEVEL}）`}
          onChange={(event) => onLevelChange(Number(event.target.value))}
        />
        <div className="level-ticks" aria-hidden="true"><span>{MIN_LEVEL}</span><span>{MAX_LEVEL}</span></div>
      </div>

      <table className="stat-table">
        <thead>
          <tr>
            <th scope="col">属性</th>
            <th scope="col">1 级</th>
            <th scope="col">成长/级</th>
            <th scope="col" className="is-current">{level} 级</th>
            <th scope="col">{MAX_LEVEL} 级</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ descriptor, base, growthLabel, current, maximum, bonus }) => (
            <tr key={descriptor.key}>
              <th scope="row">
                {descriptor.label}
                {bonus !== null && bonus > 0 ? <em className="stat-note">额外 +{format(bonus, 1)}%</em> : null}
              </th>
              <td>{format(base, descriptor.digits)}{descriptor.suffix ?? ""}</td>
              <td className="stat-growth">{growthLabel}</td>
              <td className="stat-current">{current === null ? "—" : format(current, descriptor.digits)}</td>
              <td className="stat-max">{maximum === null ? "—" : format(maximum, descriptor.digits)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="stat-extras">
        {extras.map((group) => (
          <div className="stat-extras-group" key={group.title}>
            <span className="stat-extras-title">{group.title}</span>
            <ul>
              {group.rows.map((row) => (
                <li key={row.key}><span>{row.label}</span><strong>{row.shown}</strong></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

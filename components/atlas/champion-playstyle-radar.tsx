import type { Playstyle } from "@/lib/lol-types";

/** 官方五维玩法评分（0-3）画成五边形雷达 */
export function PlaystyleRadar({ playstyle }: { playstyle: Playstyle }) {
  const dims: Array<[keyof Playstyle, string]> = [
    ["damage", "伤害"], ["durability", "耐久"], ["crowdControl", "控制"],
    ["mobility", "机动"], ["utility", "功能"],
  ];
  const cx = 92, cy = 86, r = 54, max = 3;
  // 顶点按角度均分；值先夹到 0-3，脏数据画不出多边形也不至于把图撑破
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
          // 标签放在顶点外侧，按左右决定对齐方式，免得压到图上
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

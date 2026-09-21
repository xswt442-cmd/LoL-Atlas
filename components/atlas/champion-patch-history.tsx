import type { LolTimeline } from "@/lib/lol-types";

/** 版本改动里出现的字段名 → 中文标签 */
const STAT_LABELS: Record<string, string> = {
  hp: "生命", hp_per_level: "成长生命", hpregen: "生命回复", hpregen_per_level: "成长生命回复",
  mp: "法力", mp_per_level: "成长法力", mpregen: "法力回复", mpregen_per_level: "成长法力回复",
  armor: "护甲", armor_per_level: "成长护甲", spellblock: "魔抗", spellblock_per_level: "成长魔抗",
  attackdamage: "攻击力", attackdamage_per_level: "成长攻击力",
  attackspeed: "攻速", attackspeed_per_level: "成长攻速",
  attackrange: "射程", movespeed: "移速", crit: "暴击", crit_per_level: "成长暴击",
};

/** 把 `16.18.1` 这样的版本号拆成可比较的数字段 */
const versionValue = (version: string) => version.split(".").map((part) => Number.parseInt(part, 10));

/** 版本改动：逐版本列出字段的 旧值 → 新值 */
export function PatchHistory({ changes }: { changes: LolTimeline["champions"][string] }) {
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
                <span className="timeline-field">{STAT_LABELS[field] ?? field}</span>
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

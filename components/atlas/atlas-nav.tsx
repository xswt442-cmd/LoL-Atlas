/**
 * 侧边模块导航。
 *
 * 图标与取值分开：取值来自 `lib/atlas-tabs.mjs`（地址栏解析与 WebMCP 也用它），
 * 图标在这里用 `Record<AtlasTab, …>` 补齐 —— 漏一个会被类型检查拦住。
 */

import { Boxes, Gem, History, Shield, Sparkles, Swords, type LucideIcon } from "lucide-react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ATLAS_TABS } from "@/lib/atlas-tabs.mjs";

type AtlasTab = (typeof ATLAS_TABS)[number]["value"];

const TAB_ICONS: Record<AtlasTab, LucideIcon> = {
  champions: Swords,
  items: Shield,
  runes: Gem,
  summoner: Sparkles,
  builder: Boxes,
};

export function AtlasNav({ dataVersion }: { dataVersion: string | null }) {
  return (
    <aside className="atlas-nav">
      <TabsList variant="line" className="atlas-nav-list">
        {ATLAS_TABS.map(({ value, label }) => {
          const Icon = TAB_ICONS[value];
          return (
            <TabsTrigger key={value} value={value} className="atlas-nav-item">
              <Icon aria-hidden="true" /><span>{label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      <div className="archive-note">
        <History aria-hidden="true" /><span>数据快照</span><strong>{dataVersion ?? "—"}</strong>
      </div>
    </aside>
  );
}

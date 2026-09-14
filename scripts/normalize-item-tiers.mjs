import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function itemTier(item) {
  const hasComponents = item.components.length > 0;
  const hasUpgrades = item.builds_into.length > 0;
  if (!hasComponents) return hasUpgrades ? "基础件" : "独立";
  return hasUpgrades ? "史诗" : "成品";
}

for (const value of process.argv.slice(2).length ? process.argv.slice(2) : ["public/data/lol.json", "data/releases/16.18.1/lol.json"]) {
  const filename = path.resolve(value);
  const data = JSON.parse(await readFile(filename, "utf8"));
  let changed = 0;
  for (const item of data.items) {
    const next = itemTier(item);
    if (item.tier !== next) {
      item.tier = next;
      changed += 1;
    }
  }
  await writeFile(filename, `${JSON.stringify(data)}\n`);
  console.log(`${path.relative(process.cwd(), filename)}: normalized ${changed} item tiers.`);
}

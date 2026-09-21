import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PRIMARY_SOURCE = "public/data/lol.json";

export function itemTier(item) {
  const hasComponents = item.components.length > 0;
  const hasUpgrades = item.builds_into.length > 0;
  if (!hasComponents) return hasUpgrades ? "基础件" : "独立";
  return hasUpgrades ? "史诗" : "成品";
}

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * 默认输入：工作快照，加上它所声明版本对应的发布副本。
 *
 * 发布目录从 `meta.version` 推导，是为了避免硬编码的版本号过期后出现两种事故：
 * 静默改写已发布的快照，以及漏掉下一个 patch 的目录。
 */
async function defaultTargets() {
  const data = JSON.parse(await readFile(PRIMARY_SOURCE, "utf8"));
  const version = data.meta?.version;
  if (!version) throw new Error(`${PRIMARY_SOURCE} has no meta.version`);
  return [PRIMARY_SOURCE, path.join("data", "releases", version, "lol.json")];
}

const explicit = process.argv.slice(2);
const targets = explicit.length ? explicit : await defaultTargets();

for (const value of targets) {
  const filename = path.resolve(value);
  if (!(await exists(filename))) {
    // 显式传进来的文件不存在是错误；推导出来的那个只是还没进仓库而已。
    if (explicit.length) throw new Error(`not found: ${value}`);
    console.warn(`已跳过 ${path.relative(process.cwd(), filename)}：发布副本尚未生成`);
    continue;
  }
  const original = await readFile(filename, "utf8");
  const data = JSON.parse(original);
  let changed = 0;
  for (const item of data.items) {
    const next = itemTier(item);
    if (item.tier !== next) {
      item.tier = next;
      changed += 1;
    }
  }
  // 重写一份没有变化的文件会白白搅动 diff，更糟的是会让它的 sha256 与该版本
  // `manifest.json` 里记录的值对不上。
  if (!changed) {
    console.log(`${path.relative(process.cwd(), filename)}: 已是目标分级，未改动。`);
    continue;
  }
  // 沿用源文件的末尾换行，其余字节保持不变。
  const trailing = original.endsWith("\n") ? "\n" : "";
  await writeFile(filename, `${JSON.stringify(data)}${trailing}`);
  console.log(`${path.relative(process.cwd(), filename)}: 已归正 ${changed} 件装备的分级。`);
}

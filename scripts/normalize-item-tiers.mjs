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
 * Default inputs: the working snapshot plus the release copy for the patch it
 * declares. Deriving the release directory from `meta.version` keeps this from
 * silently rewriting an already-published snapshot — and from missing the next
 * patch's directory — when the hardcoded version goes stale.
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
    // An explicitly named file is a mistake; a derived one just is not staged yet.
    if (explicit.length) throw new Error(`not found: ${value}`);
    console.warn(`skipped ${path.relative(process.cwd(), filename)}: release copy not staged yet`);
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
  // Rewriting an unchanged file would churn the diff and, worse, move its sha256
  // out from under the `manifest.json` recorded for this release.
  if (!changed) {
    console.log(`${path.relative(process.cwd(), filename)}: already normalized.`);
    continue;
  }
  // Match the source file's trailing newline so the rest of the bytes stay put.
  const trailing = original.endsWith("\n") ? "\n" : "";
  await writeFile(filename, `${JSON.stringify(data)}${trailing}`);
  console.log(`${path.relative(process.cwd(), filename)}: normalized ${changed} item tiers.`);
}

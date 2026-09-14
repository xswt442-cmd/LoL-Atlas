import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

async function describeFile(filename) {
  const content = await readFile(filename);
  const info = await stat(filename);
  return { bytes: info.size, sha256: createHash("sha256").update(content).digest("hex") };
}

const source = path.resolve(process.argv[2] ?? "public/data/lol.json");
const data = JSON.parse(await readFile(source, "utf8"));
const releaseDirectory = path.resolve(process.argv[3] ?? path.join("data", "releases", data.meta.version));
const jsonPath = path.join(releaseDirectory, "lol.json");
const dbPath = path.join(releaseDirectory, "lol.db");
await mkdir(releaseDirectory, { recursive: true });

const files = { "lol.json": await describeFile(jsonPath) };
try { files["lol.db"] = await describeFile(dbPath); } catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const manifest = {
  schemaVersion: 1,
  patch: data.meta.version,
  txPatch: data.meta.tx_version ?? null,
  builtAt: data.meta.built_at ?? null,
  source: data.meta.source ?? null,
  counts: {
    champions: data.champions.length,
    spells: data.champions.reduce((count, champion) => count + champion.spells.length, 0),
    items: data.items.length,
    runes: data.trees.reduce((count, tree) => count + tree.slots.flat().length, 0),
    statMods: data.stat_mods.length,
    summonerSpells: data.summoner.length,
  },
  files,
};
await writeFile(path.join(releaseDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest written for ${manifest.patch}.`);

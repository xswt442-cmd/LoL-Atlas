// Prepares the data snapshot for the browser and gives every piece a
// content-addressed URL so it can be cached forever.
//
// The published snapshot is ~3 MB and fetched on every page load, but 58% of it
// is `wiki` — the English lolwiki write-ups, which only render after the reader
// flips the "EN 原案" switch on a champion. Shipping that to everyone costs more
// than everything else combined, so the build splits it into per-champion files
// and the client fetches the one it needs.
//
// The hash in these paths is taken from the whole `public/data/lol.json`, so one
// value identifies the dataset and both the main file and the shards share it.
// A version query would have been simpler, but the Workers asset cache ignores
// the query string (`?v=a` and `?v=b` hit the same entry), so only the path
// separates cache entries.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const SOURCE_PATH = ["public", "data", "lol.json"];
const OUTPUT_DIRECTORY = ["dist", "client", "data"];
const WIKI_DIRECTORY = "wiki";
const HASH_LENGTH = 8;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Writes the browser payload: the snapshot without `wiki`, plus one wiki file per champion. */
export function dataAssets(): Plugin {
  let root = process.cwd();
  let hash = "";
  let written = false;

  return {
    name: "lol-atlas-data-assets",
    configResolved(config) {
      root = config.root;
    },
    // `define` has to come back from this hook, so the hash is computed from the
    // project root rather than from `config.root` (which is not final yet).
    config() {
      const raw = readFileSync(resolve(process.cwd(), ...SOURCE_PATH));
      hash = createHash("sha256").update(raw).digest("hex").slice(0, HASH_LENGTH);
      return {
        define: {
          __LOL_DATA_URL__: JSON.stringify(`/data/lol.${hash}.json`),
          // `wiki` is keyed by champion id, but the numeric `key` is what names
          // the shard: ids like `Kha'Zix` would need percent-encoding in the URL
          // and the asset layer matches on the raw path.
          __LOL_WIKI_BASE__: JSON.stringify(`/data/${WIKI_DIRECTORY}/${hash}`),
        },
      };
    },
    // vinext runs five builds through this hook (one per step). The client
    // environment only appears in step 4, and it wipes and rebuilds its output
    // directory when it does — anything written before that is thrown away, so
    // wait until the client output exists. The source is read from `public/`
    // rather than from the client directory because the order between this hook
    // and the public-directory copy is not guaranteed.
    async closeBundle() {
      if (!hash || written) return;
      if (!(await exists(resolve(root, "dist", "client", "_next")))) return;
      const source = resolve(root, ...SOURCE_PATH);
      if (!(await exists(source))) return;
      written = true;

      const outputDirectory = resolve(root, ...OUTPUT_DIRECTORY);
      const dataset = JSON.parse(readFileSync(source, "utf8"));
      const wiki = dataset.wiki ?? {};
      delete dataset.wiki;
      const keyByChampionId = new Map(
        dataset.champions.map((champion: { id: string; key: string }) => [champion.id, champion.key]),
      );

      await mkdir(outputDirectory, { recursive: true });
      await writeFile(resolve(outputDirectory, `lol.${hash}.json`), JSON.stringify(dataset), "utf8");

      const wikiDirectory = resolve(outputDirectory, WIKI_DIRECTORY, hash);
      await mkdir(wikiDirectory, { recursive: true });
      const shards = Object.entries(wiki).map(([championId, entry]) => {
        const key = keyByChampionId.get(championId);
        // A wiki entry with no matching champion has no page to render on.
        if (!key) return Promise.resolve();
        return writeFile(resolve(wikiDirectory, `${key}.json`), JSON.stringify(entry), "utf8");
      });
      await Promise.all(shards);
    },
  };
}

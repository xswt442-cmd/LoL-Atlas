// Gives the data snapshot a content-addressed URL so it can be cached forever.
//
// The snapshot is ~3 MB and every page load fetches it. Serving it with a short
// max-age keeps repeat visitors off the origin but leaves the site stale for up
// to that window after a patch ships; serving it `immutable` under a fixed path
// would break data updates entirely. Hashing the content into the path resolves
// both: the URL changes exactly when the bytes do.
//
// A version query would have been simpler, but the Workers asset cache ignores
// the query string, so `/data/lol.json?v=a` and `?v=b` share one cache entry.
// The path is the only thing that separates them.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { access, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const SOURCE_PATH = ["public", "data", "lol.json"];
const OUTPUT_DIRECTORY = ["dist", "client", "data"];
const HASH_LENGTH = 8;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Copies the data snapshot to `lol.<hash>.json` and exposes that URL as `__LOL_DATA_URL__`. */
export function hashedDataAsset(): Plugin {
  let root = process.cwd();
  let filename = "";

  return {
    name: "lol-atlas-hashed-data",
    configResolved(config) {
      root = config.root;
    },
    // `define` has to come back from this hook, so the hash is computed from the
    // project root rather than from `config.root` (which is not final yet).
    config() {
      const hash = createHash("sha256")
        .update(readFileSync(resolve(process.cwd(), ...SOURCE_PATH)))
        .digest("hex")
        .slice(0, HASH_LENGTH);
      filename = `lol.${hash}.json`;
      return { define: { __LOL_DATA_URL__: JSON.stringify(`/data/${filename}`) } };
    },
    // vinext runs several builds through this hook, so this stays idempotent and
    // copies from `public/` rather than from the client output directory: the
    // order between this hook and the public-directory copy is not guaranteed.
    async closeBundle() {
      if (!filename) return;
      const source = resolve(root, ...SOURCE_PATH);
      if (!(await exists(source))) return;
      const directory = resolve(root, ...OUTPUT_DIRECTORY);
      const target = resolve(directory, filename);
      if (await exists(target)) return;
      await mkdir(directory, { recursive: true });
      await copyFile(source, target);
    },
  };
}

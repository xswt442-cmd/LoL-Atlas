// Prepares the data snapshot for the browser and gives every piece a
// content-addressed URL so it can be cached forever.
//
// The published snapshot is ~3 MB and fetched on every page load, but 58% of it
// is `wiki` — the English lolwiki write-ups, which only render after the reader
// flips the "EN 原案" switch on a champion. Shipping that to everyone costs more
// than everything else combined, so the build splits it into per-champion files
// and the client fetches the one it needs.
//
// The splitting itself lives in `data-payload.mjs` so it can be unit-tested.
// A version query would have been a simpler way to bust caches, but the Workers
// asset cache ignores the query string (`?v=a` and `?v=b` hit the same entry),
// so only the path separates cache entries.
import { readFileSync } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { buildDataPayloads, META_FILENAME, WIKI_DIRECTORY } from "./data-payload.mjs";

const SOURCE_PATH = ["public", "data", "lol.json"];
const OUTPUT_DIRECTORY = ["dist", "client", "data"];
// Vite copies `public/` verbatim into `dist/client`, which puts the 3 MB snapshot
// there as well. Nothing fetches it — the client reads the content-addressed file
// and the complete snapshot already travels with git under `data/releases/` — so
// left in place it only adds 3 MB to every deploy.
const PUBLIC_COPY_FILENAME = "lol.json";

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
  let payloads: ReturnType<typeof buildDataPayloads> | null = null;
  let written = false;

  return {
    name: "lol-atlas-data-assets",
    configResolved(config) {
      root = config.root;
    },
    // `define` has to come back from this hook, so this reads from the project
    // root rather than from `config.root` (which is not final yet).
    config() {
      if (!payloads) {
        payloads = buildDataPayloads(JSON.parse(readFileSync(resolve(process.cwd(), ...SOURCE_PATH), "utf8")));
      }
      return {
        define: {
          __LOL_DATA_URL__: JSON.stringify(`/data/${payloads.mainFilename}`),
          __LOL_WIKI_BASE__: JSON.stringify(`/data/${WIKI_DIRECTORY}/${payloads.hash}`),
        },
      };
    },
    // vinext runs five builds through this hook (one per step). The client
    // environment only appears in step 4, and it wipes and rebuilds its output
    // directory when it does — anything written before that is thrown away, so
    // wait until the client output exists.
    async closeBundle() {
      if (!payloads || written) return;
      if (!(await exists(resolve(root, "dist", "client", "_next")))) return;
      written = true;

      const outputDirectory = resolve(root, ...OUTPUT_DIRECTORY);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(resolve(outputDirectory, payloads.mainFilename), payloads.main, "utf8");
      await writeFile(resolve(outputDirectory, META_FILENAME), payloads.meta, "utf8");

      const wikiDirectory = resolve(outputDirectory, WIKI_DIRECTORY, payloads.hash);
      await mkdir(wikiDirectory, { recursive: true });
      await Promise.all([...payloads.shards].map(([filename, payload]) =>
        writeFile(resolve(wikiDirectory, filename), payload, "utf8"),
      ));

      // Drops the copy vite made from `public/` — see PUBLIC_COPY_FILENAME.
      await rm(resolve(outputDirectory, PUBLIC_COPY_FILENAME), { force: true });
    },
  };
}

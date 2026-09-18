import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildDataPayloads, HASH_LENGTH } from "../build/data-payload.mjs";

const dataset = {
  meta: { version: "1.2.3", tx_version: "1.2" },
  champions: [
    { id: "Lissandra", key: "127" },
    { id: "Kha'Zix", key: "121" },
  ],
  items: [{ id: "1001" }],
  wiki: {
    Lissandra: { name_zh: "丽桑卓", abilities: [] },
    "Kha'Zix": { name_zh: "卡兹克", abilities: [] },
    Nobody: { name_zh: "没有对应英雄的条目" },
  },
};

test("the browser payload drops wiki and keeps everything else", () => {
  const payloads = buildDataPayloads(dataset);
  const main = JSON.parse(payloads.main);

  assert.equal("wiki" in main, false);
  assert.deepEqual(Object.keys(main).sort(), ["champions", "items", "meta"]);
  assert.deepEqual(main.meta, dataset.meta);
  assert.deepEqual(main.champions, dataset.champions);
});

test("the hash addresses the bytes the browser actually receives", () => {
  const payloads = buildDataPayloads(dataset);
  const expected = createHash("sha256").update(payloads.main).digest("hex").slice(0, HASH_LENGTH);

  assert.equal(payloads.hash, expected);
  assert.equal(payloads.hash.length, HASH_LENGTH);
  assert.equal(payloads.mainFilename, `lol.${payloads.hash}.json`);
});

test("shards are named by numeric champion key, so ids never reach the URL", () => {
  const payloads = buildDataPayloads(dataset);

  // `Kha'Zix` would need percent-encoding as a path segment.
  assert.deepEqual([...payloads.shards.keys()].sort(), ["121.json", "127.json"]);
  assert.equal(JSON.parse(payloads.shards.get("127.json")).name_zh, "丽桑卓");
});

test("a wiki entry with no matching champion is dropped", () => {
  const payloads = buildDataPayloads(dataset);

  // Three entries in, two files out — `Nobody` has no champion to render on.
  assert.equal(Object.keys(dataset.wiki).length, 3);
  assert.equal(payloads.shards.size, 2);
});

test("meta.json carries only the meta block", () => {
  const payloads = buildDataPayloads(dataset);

  assert.deepEqual(JSON.parse(payloads.meta), dataset.meta);
});

test("the input dataset is left untouched", () => {
  const before = JSON.stringify(dataset);
  buildDataPayloads(dataset);

  assert.equal(JSON.stringify(dataset), before);
  assert.equal("wiki" in dataset, true);
});

test("the published snapshot splits without losing wiki entries", async () => {
  const source = await readFile(new URL("../public/data/lol.json", import.meta.url), "utf8");
  const published = JSON.parse(source);
  const payloads = buildDataPayloads(published);

  // Every wiki entry maps to a champion, so no shard may be silently dropped.
  assert.equal(payloads.shards.size, Object.keys(published.wiki).length);
  assert.equal("wiki" in JSON.parse(payloads.main), false);
  assert.deepEqual(JSON.parse(payloads.meta), published.meta);
});

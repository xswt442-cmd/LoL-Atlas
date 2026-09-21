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

test("浏览器载荷剥掉 wiki，其余字段一个不少", () => {
  const payloads = buildDataPayloads(dataset);
  const main = JSON.parse(payloads.main);

  assert.equal("wiki" in main, false);
  assert.deepEqual(Object.keys(main).sort(), ["champions", "items", "meta"]);
  assert.deepEqual(main.meta, dataset.meta);
  assert.deepEqual(main.champions, dataset.champions);
});

test("hash 指向浏览器实际收到的那串字节", () => {
  const payloads = buildDataPayloads(dataset);
  const expected = createHash("sha256").update(payloads.main).digest("hex").slice(0, HASH_LENGTH);

  assert.equal(payloads.hash, expected);
  assert.equal(payloads.hash.length, HASH_LENGTH);
  assert.equal(payloads.mainFilename, `lol.${payloads.hash}.json`);
});

test("分片按英雄数字 key 命名，id 永远进不了 URL", () => {
  const payloads = buildDataPayloads(dataset);

  // `Kha'Zix` 作为路径段需要百分号转义，所以分片不能这么命名。
  assert.deepEqual([...payloads.shards.keys()].sort(), ["121.json", "127.json"]);
  assert.equal(JSON.parse(payloads.shards.get("127.json")).name_zh, "丽桑卓");
});

test("没有对应英雄的原案条目被丢弃", () => {
  const payloads = buildDataPayloads(dataset);

  // 进来三条，出去两个文件 —— `Nobody` 没有对应英雄，无处可渲染。
  assert.equal(Object.keys(dataset.wiki).length, 3);
  assert.equal(payloads.shards.size, 2);
});

test("meta.json 只装 meta 块", () => {
  const payloads = buildDataPayloads(dataset);

  assert.deepEqual(JSON.parse(payloads.meta), dataset.meta);
});

test("输入数据不被改写", () => {
  const before = JSON.stringify(dataset);
  buildDataPayloads(dataset);

  assert.equal(JSON.stringify(dataset), before);
  assert.equal("wiki" in dataset, true);
});

test("已发布快照拆分后不丢任何原案条目", async () => {
  const source = await readFile(new URL("../public/data/lol.json", import.meta.url), "utf8");
  const published = JSON.parse(source);
  const payloads = buildDataPayloads(published);

  // 每条原案都能对上英雄，所以不允许有任何分片被静默丢弃。
  assert.equal(payloads.shards.size, Object.keys(published.wiki).length);
  assert.equal("wiki" in JSON.parse(payloads.main), false);
  assert.deepEqual(JSON.parse(payloads.meta), published.meta);
});

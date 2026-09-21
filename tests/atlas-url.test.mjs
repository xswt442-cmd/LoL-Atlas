import assert from "node:assert/strict";
import test from "node:test";

import { historyActionFor, readAtlasState, writeAtlasState } from "../lib/atlas-url.mjs";

test("第一次写入只建立 URL，不产生可后退的历史", () => {
  // 还没有上一页，后退无处可去
  assert.equal(historyActionFor(null, { tab: "champions", selectedId: "1" }), "replace");
});

test("同一位置重复写入不会反复 push", () => {
  const at = { tab: "items", selectedId: "1001" };

  assert.equal(historyActionFor(null, at), "replace");
  // effect 会因无关 state 变化重跑，那些重跑不该堆历史
  assert.equal(historyActionFor(at, { ...at }), "replace");
});

test("换模块算一次导航", () => {
  assert.equal(historyActionFor({ tab: "champions", selectedId: "1" }, { tab: "items", selectedId: "" }), "push");
});

test("换记录算一次导航", () => {
  assert.equal(historyActionFor({ tab: "champions", selectedId: "1" }, { tab: "champions", selectedId: "2" }), "push");
});

test("搜索词与配装变化只重写当前条目", () => {
  const here = { tab: "champions", selectedId: "1" };

  // 位置相同、只有搜索词不同 —— 输入名字不该每敲一个字符多一条历史
  assert.equal(historyActionFor(here, { tab: here.tab, selectedId: here.selectedId }), "replace");
});

test("选中项被清空仍算导航", () => {
  assert.equal(historyActionFor({ tab: "items", selectedId: "1001" }, { tab: "items", selectedId: "" }), "push");
});

test("解析：缺参数时给出干净的默认状态", () => {
  assert.deepEqual(readAtlasState(""), {
    tab: "champions", query: "", selectedId: "", itemIds: [],
  });
});

test("解析：非法 tab 退回英雄页，而不是留在未知模块", () => {
  assert.equal(readAtlasState("?tab=not-a-tab").tab, "champions");
  assert.equal(readAtlasState("?tab=items").tab, "items");
});

test("解析：配装超过六件时只取前六件", () => {
  const parsed = readAtlasState("?b=1,2,3,4,5,6,7,8");

  assert.deepEqual(parsed.itemIds, ["1", "2", "3", "4", "5", "6"]);
});

test("序列化：默认值不出现在 URL 里", () => {
  assert.equal(writeAtlasState({ tab: "champions", query: "", selectedId: "", itemIds: [] }), "?v=1");
});

test("序列化：配装页不带 id，配装用 b 承载", () => {
  const url = writeAtlasState({ tab: "builder", query: "", selectedId: "1001", itemIds: ["1001", "3006"] });

  assert.equal(url, "?v=1&tab=builder&b=1001%2C3006");
});

test("读写往返：状态不会在解析与序列化之间漂移", () => {
  const state = { tab: "items", query: "无尽", selectedId: "3031", itemIds: ["1001"] };

  assert.deepEqual(readAtlasState(writeAtlasState(state)), state);
});

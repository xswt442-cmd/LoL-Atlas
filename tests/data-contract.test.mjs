import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { comparePatchVersions, latestPatchVersion } from "../scripts/lib/patch-version.mjs";
import { validateData, validateDataFile } from "../scripts/validate-data.mjs";
import { classifyTag } from "../scripts/validate-tag.mjs";

test("版本号按数值排序，而不是按字符串", () => {
  assert.ok(comparePatchVersions("16.18.1", "16.9.1") > 0);
  assert.equal(latestPatchVersion(["16.9.1", "16.18.1", "15.24.2"]), "16.18.1");
});

test("应用 tag 与数据 tag 用两套命名空间", () => {
  assert.deepEqual(classifyTag("v0.1.0", "0.1.0", "16.18.1"), { kind: "app", version: "0.1.0" });
  assert.deepEqual(classifyTag("patch-16.18.1", "0.1.0", "16.18.1"), { kind: "patch", version: "16.18.1" });
  assert.throws(() => classifyTag("v16.18.1", "0.1.0", "16.18.1"));
});

test("已发布数据满足图鉴的数据契约", async () => {
  const publicUrl = new URL("../public/data/lol.json", import.meta.url);
  const { data, errors } = await validateDataFile(publicUrl);
  assert.deepEqual(errors, []);
  const releaseUrl = new URL(`../data/releases/${data.meta.version}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", releaseUrl), "utf8"));
  assert.equal(data.champions.length, manifest.counts.champions);
  assert.equal(data.items.length, manifest.counts.items);
  assert.equal(data.champions.reduce((count, champion) => count + champion.spells.length, 0), manifest.counts.spells);
  assert.equal(await readFile(publicUrl, "utf8"), await readFile(new URL("lol.json", releaseUrl), "utf8"));
  for (const [filename, expected] of Object.entries(manifest.files)) {
    const content = await readFile(new URL(filename, releaseUrl));
    assert.equal(content.byteLength, expected.bytes);
    assert.equal(createHash("sha256").update(content).digest("hex"), expected.sha256);
  }
});

test("原案副源覆盖全量英雄，且每个技能都有细节", async () => {
  const { data, errors } = await validateDataFile(new URL("../public/data/lol.json", import.meta.url));
  assert.deepEqual(errors, []);
  const wiki = data.wiki ?? {};
  assert.equal(Object.keys(wiki).length, data.champions.length);
  const ability = wiki.Ahri?.abilities.find((entry) => entry.slot === "Q");
  assert.ok(ability, "样本科技能必须存在于原案副源里");
  assert.ok(Object.keys(ability.stats).length > 0, "原案技能必须带数值网格");
  assert.ok(Object.keys(ability.attrs).length > 0, "原案技能必须带机制属性");
  assert.ok(ability.notes.length > 0, "原案技能必须带机制备注");
});

test("会让渲染崩掉的形状会被校验拦下", async () => {
  const { data } = await validateDataFile(new URL("../public/data/lol.json", import.meta.url));

  const badWiki = structuredClone(data);
  badWiki.wiki.Ahri.abilities.find((entry) => entry.slot === "Q").notes = null;
  assert.ok(validateData(badWiki).some((error) => error.includes("wiki Ahri Q notes")));

  const badTimeline = structuredClone(data);
  badTimeline.timeline.champions["103"] = [{ v: null, c: null }];
  const timelineErrors = validateData(badTimeline);
  assert.ok(timelineErrors.some((error) => error.includes("timeline.champions.103 has an invalid patch version")));
  assert.ok(timelineErrors.some((error) => error.includes("timeline.champions.103 entry ? must carry changes")));
});

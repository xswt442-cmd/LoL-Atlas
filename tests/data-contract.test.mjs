import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { comparePatchVersions, latestPatchVersion } from "../scripts/lib/patch-version.mjs";
import { validateDataFile } from "../scripts/validate-data.mjs";
import { classifyTag } from "../scripts/validate-tag.mjs";

test("patch versions are ordered numerically", () => {
  assert.ok(comparePatchVersions("16.18.1", "16.9.1") > 0);
  assert.equal(latestPatchVersion(["16.9.1", "16.18.1", "15.24.2"]), "16.18.1");
});

test("application and data tags use separate namespaces", () => {
  assert.deepEqual(classifyTag("v0.1.0", "0.1.0", "16.18.1"), { kind: "app", version: "0.1.0" });
  assert.deepEqual(classifyTag("patch-16.18.1", "0.1.0", "16.18.1"), { kind: "patch", version: "16.18.1" });
  assert.throws(() => classifyTag("v16.18.1", "0.1.0", "16.18.1"));
});

test("published data satisfies the atlas contract", async () => {
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

test("wiki source covers the roster and carries per-ability detail", async () => {
  const { data, errors } = await validateDataFile(new URL("../public/data/lol.json", import.meta.url));
  assert.deepEqual(errors, []);
  const wiki = data.wiki ?? {};
  assert.equal(Object.keys(wiki).length, data.champions.length);
  const ability = wiki.Ahri?.abilities.find((entry) => entry.slot === "Q");
  assert.ok(ability, "sample ability must exist in the wiki source");
  assert.ok(Object.keys(ability.stats).length > 0, "wiki ability must carry a stats grid");
  assert.ok(Object.keys(ability.attrs).length > 0, "wiki ability must carry mechanic attributes");
  assert.ok(ability.notes.length > 0, "wiki ability must carry notes");
});

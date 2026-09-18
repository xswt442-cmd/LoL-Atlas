import assert from "node:assert/strict";
import test from "node:test";

import { historyActionFor } from "../lib/url-history.mjs";

test("the first write only establishes the URL", () => {
  // Nothing to go back to yet, so there is no page to return to.
  assert.equal(historyActionFor(null, { tab: "champions", selectedId: "1" }), "replace");
});

test("repeating the same location never pushes again", () => {
  const at = { tab: "items", selectedId: "1001" };

  assert.equal(historyActionFor(null, at), "replace");
  // The effect re-runs on unrelated state changes; those must not stack entries.
  assert.equal(historyActionFor(at, { ...at }), "replace");
});

test("opening another module earns a history entry", () => {
  assert.equal(historyActionFor({ tab: "champions", selectedId: "1" }, { tab: "items", selectedId: "" }), "push");
});

test("landing on another record earns a history entry", () => {
  assert.equal(historyActionFor({ tab: "champions", selectedId: "1" }, { tab: "champions", selectedId: "2" }), "push");
});

test("search terms and loadout edits rewrite the current entry", () => {
  const here = { tab: "champions", selectedId: "1" };

  // Same location, different query — typing a name must not add an entry per
  // keystroke.
  assert.equal(historyActionFor(here, { tab: here.tab, selectedId: here.selectedId }), "replace");
});

test("a selection cleared back to empty is still a navigation", () => {
  assert.equal(historyActionFor({ tab: "items", selectedId: "1001" }, { tab: "items", selectedId: "" }), "push");
});

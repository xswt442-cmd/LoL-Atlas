// Whether a URL update deserves a new history entry, kept as a plain function so
// the rule can be tested without a DOM (see tests/url-history.test.mjs).
//
// The atlas keeps its whole view state in the query string. Getting this wrong in
// either direction is user-visible: always replacing means Back leaves the site,
// always pushing means typing a champion name buries the previous page under one
// entry per keystroke.

/**
 * @typedef {{ tab: string, selectedId: string }} Location
 * @param {Location | null} previous 上一次写入地址栏的组合；null 表示本次是首屏
 * @param {Location} current
 * @returns {"push" | "replace"}
 */
export function historyActionFor(previous, current) {
  // Nothing to go back to yet — the first write only establishes the URL.
  if (previous === null) return "replace";
  // Opening another module, or landing on another record, is a navigation.
  if (previous.tab !== current.tab) return "push";
  if (previous.selectedId !== current.selectedId) return "push";
  // Search terms and loadout edits rewrite the page the reader is already on.
  return "replace";
}

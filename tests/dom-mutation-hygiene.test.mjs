import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * React 只管自己的 fiber 树。绕过它直接删 DOM 节点，会让两边脱节，
 * 之后任何一次提交只要需要卸载那个节点，就抛
 * "Failed to execute 'removeChild' on 'Node'" 把整页打崩。
 *
 * 这不是假想：`champion-detail.tsx` 曾经在皮肤图 onError 里写
 * `event.currentTarget.closest("figure")?.remove()`。阿狸一页 95 张皮肤图里
 * 有 73 张是缺原画的炫彩条目，于是连着删 73 次……切英雄时必崩。
 * 正确做法是用状态标记失败、交给 React 自己卸载。
 *
 * 这里把这条约定固化下来：`components/` 与 `app/` 下不允许出现命令式节点删除。
 */

const root = path.resolve(import.meta.dirname, "..");
const SCAN_DIRS = ["app", "components"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

/** `classList.remove(...)` 改的是 class 不是 DOM 树，放行；其余 `.remove()` 一律拦。 */
const IMPERATIVE_REMOVE = /(?<!classList)\.remove\s*\(/;

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

test("components never remove React-managed DOM nodes imperatively", async () => {
  const offenders = [];
  for (const dir of SCAN_DIRS) {
    for (const file of await collect(path.join(root, dir))) {
      const lines = (await readFile(file, "utf8")).split("\n");
      lines.forEach((line, index) => {
        if (IMPERATIVE_REMOVE.test(line)) {
          offenders.push(`${path.relative(root, file)}:${index + 1}  ${line.trim()}`);
        }
      });
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `命令式删除 DOM 节点会让 React 的 fiber 树与真实 DOM 脱节（removeChild 崩溃）。`
    + `改用状态标记失败、让 React 自己卸载：\n${offenders.join("\n")}`,
  );
});

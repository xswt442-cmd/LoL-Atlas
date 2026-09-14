import { appendFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { validateDataFile } from "./validate-data.mjs";

const APP_TAG = /^v(\d+\.\d+\.\d+)$/;
const PATCH_TAG = /^patch-(\d+\.\d+\.\d+)$/;

export function classifyTag(tag, packageVersion, dataPatch) {
  const app = APP_TAG.exec(tag);
  if (app) {
    if (app[1] !== packageVersion) throw new Error(`app tag ${app[1]} does not match package ${packageVersion}`);
    return { kind: "app", version: app[1] };
  }
  const patch = PATCH_TAG.exec(tag);
  if (patch) {
    if (patch[1] !== dataPatch) throw new Error(`data tag ${patch[1]} does not match current patch ${dataPatch}`);
    return { kind: "patch", version: patch[1] };
  }
  throw new Error(`unsupported tag: ${tag}`);
}

async function main() {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  if (!tag) throw new Error("tag is required");
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const { data, errors } = await validateDataFile("public/data/lol.json");
  if (errors.length) throw new Error(errors.join("\n"));
  const result = classifyTag(tag, pkg.version, data.meta.version);
  if (result.kind === "patch") {
    await readFile(path.join("data", "releases", result.version, "manifest.json"), "utf8");
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `kind=${result.kind}\nversion=${result.version}\n`);
  }
  console.log(`${tag}: valid ${result.kind} tag for ${result.version}`);
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsScript) await main();

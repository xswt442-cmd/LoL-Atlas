import { spawnSync } from "node:child_process";
import path from "node:path";

const mode = process.argv[2];
const extraArguments = process.argv.slice(3);
if (!new Set(["deploy", "preview"]).has(mode)) {
  console.error("Usage: node scripts/deploy.mjs <deploy|preview> [wrangler options]");
  process.exit(2);
}

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(path.join("scripts", "run-framework.mjs"), ["build"]);
run(path.join("node_modules", "wrangler", "bin", "wrangler.js"), mode === "deploy"
  ? ["deploy", "--config", "dist/server/wrangler.json", ...extraArguments]
  : ["versions", "upload", "--config", "dist/server/wrangler.json", ...extraArguments]);

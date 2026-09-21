// 产出 `_headers` 文件 —— Wrangler 发布 Worker 时会把它编译成边缘缓存规则。
//
// 没有这个文件时，`/_next/static/*` 以外的一切资源都以
// `Cache-Control: public, max-age=0, must-revalidate` 下发，回访者会把整份数据快照
// 再从源站拉一遍。
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";

const HEADERS_FILENAME = "_headers";

// vinext 只在 `_headers` 尚不存在时才写它自己那条 immutable 规则，所以抢在它之前
// 建文件会让那条规则被静默丢掉。它那条因此被抄在这里；改动时注意跟 `build.assetsDir`
// （默认 `_next/static`）保持一致。
//
// 这个钩子还跑在客户端环境清空输出目录（构建的第 4 步）之前，所以写入太早会被丢掉 ——
// 这也是它每次被调用都重新检查并补写、而不是只写一次的原因。
//
// `/data/lol.<hash>.json` 与 `/data/wiki/<hash>/<key>.json` 才是浏览器真正请求的：
// 路径随内容变，所以可以永久缓存。`/data/meta.json` 反过来是**故意**用固定路径的 ——
// 它只放 `meta`（几百字节），好让 shields.io 的版本徽章这类外部消费者有个稳定的读取点；
// 它的窗口很短，因为重新部署不会清掉已经缓存的条目。
//
// 裸路径 `/data/lol.json` 已经没有规则了：构建会把那份拷贝从输出里删掉
// （见 `PUBLIC_COPY_FILENAME`），所以它不再对外提供。完整快照随 git 走在
// `data/releases/<version>/` 下。
//
// 字体与图标没有内容哈希，所以给它们和可变数据路径相同的处理，只是窗口更长。
const RULES = `# 由 build/asset-headers.ts 生成，不要直接改这个文件，改那里的规则。
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/data/lol.*.json
  Cache-Control: public, max-age=31536000, immutable

/data/wiki/*
  Cache-Control: public, max-age=31536000, immutable

/data/meta.json
  Cache-Control: public, max-age=300, stale-while-revalidate=86400

/fonts/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/favicon.svg
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400
`;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 把资源缓存规则写进客户端产物的 `_headers`。 */
export function assetHeaders(): Plugin {
  let root = process.cwd();

  return {
    name: "lol-atlas-asset-headers",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const target = resolve(root, "dist", "client", HEADERS_FILENAME);
      // vinext 会跑多轮构建：第一轮客户端目录可能还不存在，后面某轮则可能已经有内容
      await mkdir(dirname(target), { recursive: true });
      const current = (await exists(target)) ? await readFile(target, "utf8") : "";
      if (current.includes("由 build/asset-headers.ts 生成")) return;
      const separator = current && !current.endsWith("\n") ? "\n\n" : current ? "\n" : "";
      await writeFile(target, `${current}${separator}${RULES}`, "utf8");
    },
  };
}

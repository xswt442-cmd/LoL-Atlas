// 为浏览器准备数据快照，并给每一块内容寻址的 URL，好让它们能被永久缓存。
//
// 发布的快照约 3 MB，每次打开页面都会拉一次，但其中 58% 是 `wiki` —— lolwiki 的英文原案，
// 只有在读者某位英雄下打开「EN 原案」开关时才用得到。把它发给所有人，代价超过其余全部
// 数据之和，所以构建时按英雄拆成一个个文件，浏览器只取需要的那一份。
//
// 拆分本身放在 `data-payload.mjs`，这样能单测。
// 用版本号做查询参数本来更省事，但这个 Worker 的资源缓存**忽略 query string**
// （`?v=a` 与 `?v=b` 命中同一条），所以只有路径能区分缓存条目。
import { readFileSync } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { buildDataPayloads, META_FILENAME, WIKI_DIRECTORY } from "./data-payload.mjs";

const SOURCE_PATH = ["public", "data", "lol.json"];
const OUTPUT_DIRECTORY = ["dist", "client", "data"];
// Vite 会把 `public/` 原样拷进 `dist/client`，那份 3 MB 快照也跟着进去了。
// 没有任何东西请求它 —— 浏览器读的是内容寻址的那份，完整快照本身又随 git 走在
// `data/releases/` 下 —— 留着它只是给每次部署白加 3 MB。
const PUBLIC_COPY_FILENAME = "lol.json";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 写出浏览器载荷：剥掉 `wiki` 的快照，外加每个英雄一个原案文件。 */
export function dataAssets(): Plugin {
  let root = process.cwd();
  let payloads: ReturnType<typeof buildDataPayloads> | null = null;
  let written = false;

  return {
    name: "lol-atlas-data-assets",
    configResolved(config) {
      root = config.root;
    },
    // `define` 必须从这个钩子返回，所以这里从项目根读取，而不是用 `config.root`
    // （那时它还没定下来）。
    config() {
      if (!payloads) {
        payloads = buildDataPayloads(JSON.parse(readFileSync(resolve(process.cwd(), ...SOURCE_PATH), "utf8")));
      }
      return {
        define: {
          __LOL_DATA_URL__: JSON.stringify(`/data/${payloads.mainFilename}`),
          __LOL_WIKI_BASE__: JSON.stringify(`/data/${WIKI_DIRECTORY}/${payloads.hash}`),
        },
      };
    },
    // vinext 会分 5 步构建、每步都调用这个钩子。客户端环境到第 4 步才出现，而它出现时
    // 会清空并重建自己的输出目录 —— 早于那之前的写入全会被丢掉，所以要等客户端产物存在。
    async closeBundle() {
      if (!payloads || written) return;
      if (!(await exists(resolve(root, "dist", "client", "_next")))) return;
      written = true;

      const outputDirectory = resolve(root, ...OUTPUT_DIRECTORY);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(resolve(outputDirectory, payloads.mainFilename), payloads.main, "utf8");
      await writeFile(resolve(outputDirectory, META_FILENAME), payloads.meta, "utf8");

      const wikiDirectory = resolve(outputDirectory, WIKI_DIRECTORY, payloads.hash);
      await mkdir(wikiDirectory, { recursive: true });
      await Promise.all([...payloads.shards].map(([filename, payload]) =>
        writeFile(resolve(wikiDirectory, filename), payload, "utf8"),
      ));

      // 删掉 vite 从 `public/` 拷来的那份，见 PUBLIC_COPY_FILENAME。
      await rm(resolve(outputDirectory, PUBLIC_COPY_FILENAME), { force: true });
    },
  };
}

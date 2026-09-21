import vinext from "vinext";
import { defineConfig } from "vite";
import pkg from "./package.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { assetHeaders } from "./build/asset-headers";
import { dataAssets } from "./build/data-assets";

// macOS 的 Seatbelt 会挡住 FSEvents，所以 Codex 预览里的 HMR 得靠轮询。
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async () => {
  // 除非明确要求联网抓取，否则用 Miniflare 本地的 Request.cf 占位值。
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Wrangler 与 Miniflare 的状态都留在项目目录内。这些是非机密的工具配置；
  // 应用自己的环境变量应当放在被忽略的 `.env*` 文件里。
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Cloudflare 插件在被 import 时就把日志路径定下来了。
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // 在这里读一次，而不是在页面里 import package.json：运行时属性访问无法被
    // tree-shake，为了打印一个字符串就会把整份依赖清单带进服务端产物。
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
      // 把 wiki 从快照里拆出去，并给拆出来的两半都做内容寻址。
      dataAssets(),
      // 注册在最后：它的 closeBundle 要跟在 vinext 之后追加规则。vinext 只在
      // `_headers` 尚不存在时才写自己那条，所以那条被抄进了 asset-headers.ts。
      assetHeaders(),
    ],
  };
});

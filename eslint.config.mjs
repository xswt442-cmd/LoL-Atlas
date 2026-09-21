import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 覆盖 eslint-config-next 的默认忽略列表。
  globalIgnores([
    // 以下是 eslint-config-next 自带的默认忽略项：
    ".next/**",
    "out/**",
    "testplace/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      // 这些文件是从 shadcn@4.17.0 原样拷来的：保持与上游一致，把更严的规则
      // 留给本项目自己写的代码。
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/atlas/**/*.tsx"],
    rules: {
      // 图鉴里有几百张带版本号的 Riot / 腾讯 CDN 图标。用原生懒加载图片，
      // 免得整个图鉴都要经过付费的图片优化代理。
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;

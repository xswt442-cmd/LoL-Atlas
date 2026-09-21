# LOL Atlas

<p align="center">
  <a href="https://lol-atlas.xswt.fyi"><img src="docs/assets/lol-atlas-banner.png" alt="LOL Atlas" width="100%"></a>
</p>

<p align="center">
  <a href="https://lol-atlas.xswt.fyi"><img src="https://img.shields.io/badge/Cloudflare-在线-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare"></a>
  <a href="https://lol-atlas.xswt.fyi"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Flol-atlas.xswt.fyi%2Fdata%2Fmeta.json&query=%24.version&label=patch&color=D6AB54" alt="Patch"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827" alt="React">
</p>

<p align="center">一个围绕《英雄联盟》资料整理与浏览的小型站点：英雄、装备、符文、召唤师技能与配装。</p>

<p align="center"><a href="README.en.md">English</a> · <a href="https://lol-atlas.xswt.fyi">在线访问</a></p>

## 功能

- 英雄索引、搜索、基础属性、技能与说明
- 装备搜索、属性、合成路线和升级关系
- 符文树、符文槽位和属性碎片
- 召唤师技能资料
- 六格配装器，支持重复装备与分享链接
- URL 保留当前模块、选中条目、搜索与配装，可直接分享

数据按 League patch 整理。

## 开发

```bash
npm ci
npm run dev     # 本地开发
npm run check   # typecheck + lint + data:validate + test
npm run build   # 产出 dist/
```

## 部署

合并到 `main` 会触发 `Deploy` 工作流：跑 `npm run ci` → `wrangler deploy` 发布到 Cloudflare Worker
`lol-atlas`。推送 `v*`（应用版本）或 `patch-*`（数据版本）标签同样会发布，并额外做两件事：校验
标签与 `package.json` 的版本一致（`tag:validate`），以及产出带 GitHub Release 的 artifact。
artifact 先于发布产出，所以凭据缺失时仍留有可下载的构建。重新发布一个已有版本，在 Actions 里
手动运行 `Deploy`。

数据版本需要先把 `data/releases/<version>/` 落地并提交，`tag:validate` 会检查其中的 `manifest.json`：

```bash
node scripts/enrich-champion-stats.mjs   # 从 CommunityDragon 补成长值与单位几何（可重复执行）
npm run release:manifest                 # 依据 public/data/lol.json 生成 manifest.json（记录 sha256）
git add data/releases/<version> public/data/lol.json
```

`enrich-champion-stats.mjs` 不能跳过：ddragon 在当前版本把全部英雄的攻击力成长写成 0，直接用它发版
会得到一组全为 0 的成长值（`data:validate` 会拦下）。

工作流需要 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 两个 repository secret。

数据来自 Riot Data Dragon `zh_CN` 与腾讯官方 CDN。本项目与 Riot Games 无隶属或背书关系。

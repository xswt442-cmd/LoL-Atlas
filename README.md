# LOL Atlas

<p align="center">
  <a href="https://lol-atlas.xswt.fyi"><img src="docs/assets/lol-atlas-banner.png" alt="LOL Atlas" width="100%"></a>
</p>

<p align="center">
  <a href="https://lol-atlas.xswt.fyi"><img src="https://img.shields.io/badge/Cloudflare-在线-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare"></a>
  <img src="https://img.shields.io/badge/patch-16.18.1-D6AB54" alt="Patch 16.18.1">
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

推送 `v*`（应用版本）或 `patch-*`（数据版本）标签会触发 `Deploy` 工作流：校验标签 → 跑 `npm run ci`
→ 上传 release artifact → `wrangler deploy` 发布到 Cloudflare Worker `lol-atlas`。artifact 先于发布
产出，所以凭据缺失时仍留有可下载的构建。分支推送不会发布；重新发布已有版本，在 Actions 里手动
运行 `Deploy`。

数据版本需要先把 `data/releases/<version>/` 落地并提交，`tag:validate` 会检查其中的 `manifest.json`：

```bash
npm run release:manifest   # 依据 public/data/lol.json 生成 manifest.json（记录 sha256）
git add data/releases/<version> public/data/lol.json
```

工作流需要 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 两个 repository secret。

数据来自 Riot Data Dragon `zh_CN` 与腾讯官方 CDN。本项目与 Riot Games 无隶属或背书关系。

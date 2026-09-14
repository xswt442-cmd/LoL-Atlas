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

## 这里有什么

LOL Atlas 把常用的游戏资料放在一个清晰、方便查找的界面里，也可以通过链接分享当前页面和配装。

- 英雄索引、搜索、基础属性、技能与说明
- 装备搜索、属性、合成路线和升级关系
- 符文树、符文槽位和属性碎片
- 召唤师技能资料
- 六格配装器，支持重复装备与分享链接
- URL 会保留当前模块、选中条目、搜索与配装内容

数据按 League patch 整理。除了游戏内资料，后续也会逐步加入更完整的 LOL Wiki 内容，让这里成为更全面的 League 资料库。

## 技术

前端使用 TypeScript、React 和 Vinext 构建，采用轻量的静态数据文件，部署在 Cloudflare Workers。项目会在保持访问简单的同时，逐步扩展 Wiki 页面、版本对比和更多查询工具。

## 开发与部署

```bash
npm ci
npm run dev

npm run deploy          # 正式部署
npm run deploy:preview  # 上传预览版本
```

应用版本和 League 数据版本分别记录：应用版本使用 `v*`，游戏数据使用 `patch-*`。

项目主页：[github.com/xswt442-cmd/LoL-Atlas](https://github.com/xswt442-cmd/LoL-Atlas)

在线站点：[lol-atlas.xswt.fyi](https://lol-atlas.xswt.fyi)

数据来自 Riot Data Dragon `zh_CN` 与腾讯官方 CDN。本项目与 Riot Games 无隶属或背书关系。

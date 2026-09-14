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

<p align="center">英雄联盟中文数据图鉴：英雄、装备、符文、召唤师技能与配装。</p>

<p align="center"><a href="README.en.md">English</a> · <a href="https://lol-atlas.xswt.fyi">在线访问</a></p>

## 开发

```bash
npm ci
npm run dev
```

## 部署

```bash
npm run deploy          # 正式部署
npm run deploy:preview  # 上传预览版本
```

## 版本标签

- `v0.1.0`：LOL Atlas 应用版本
- `patch-16.18.1`：英雄联盟数据版本

两类 tag 会由独立 CI 规则校验并产出对应构建物。

数据来自 Riot Data Dragon `zh_CN` 与腾讯官方 CDN。本项目与 Riot Games 无隶属或背书关系。

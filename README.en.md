# LOL Atlas

<p align="center">
  <a href="https://lol-atlas.xswt.fyi"><img src="docs/assets/lol-atlas-banner.png" alt="LOL Atlas" width="100%"></a>
</p>

<p align="center">
  <a href="https://lol-atlas.xswt.fyi"><img src="https://img.shields.io/badge/Cloudflare-live-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare"></a>
  <img src="https://img.shields.io/badge/patch-16.18.1-D6AB54" alt="Patch 16.18.1">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827" alt="React">
</p>

<p align="center">A Chinese League of Legends data atlas for champions, items, runes, summoner spells, and loadouts.</p>

<p align="center"><a href="README.md">中文</a> · <a href="https://lol-atlas.xswt.fyi">Live site</a></p>

## Development

```bash
npm ci
npm run dev
```

## Deployment

```bash
npm run deploy          # Production deployment
npm run deploy:preview  # Upload a preview version
```

## Tags

- `v0.1.0`: LOL Atlas application release
- `patch-16.18.1`: League data release

The tag workflow validates the two namespaces separately and uploads the matching artifact.

Data comes from Riot Data Dragon `zh_CN` and Tencent's official CDN. This project is not affiliated with or endorsed by Riot Games.

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

<p align="center">A compact site for browsing and organizing League of Legends data: champions, items, runes, summoner spells, and builds.</p>

<p align="center"><a href="README.md">中文</a> · <a href="https://lol-atlas.xswt.fyi">Live site</a></p>

## Features

- Champion index, search, base stats, abilities, and descriptions
- Item search, stats, recipes, and upgrade paths
- Rune trees, rune slots, and stat shards
- Summoner spell references
- A six-slot build planner with duplicate items and shareable URLs
- URL state for the active module, selected record, search, and build

Data is organized by League patch.

## Development

```bash
npm ci
npm run dev     # Local development
npm run check   # typecheck + lint + data:validate + test
npm run build   # Writes dist/
```

## Deployment

Pushing a `v*` (application) or `patch-*` (data) tag triggers the `Deploy` workflow: validate the tag,
run `npm run ci`, upload the release artifact, then publish to the Cloudflare Worker `lol-atlas` with
`wrangler deploy`. The artifact is produced before publishing, so a missing credential still leaves a
downloadable build behind. Branch pushes never deploy; to re-publish an existing release, run `Deploy`
manually from the Actions tab.

A data release needs its files staged under `data/releases/<version>/` and committed first —
`tag:validate` checks the `manifest.json` inside it:

```bash
npm run release:manifest   # Writes manifest.json (with sha256) from public/data/lol.json
git add data/releases/<version> public/data/lol.json
```

The workflow needs two repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Data comes from Riot Data Dragon `zh_CN` and Tencent's official CDN. This project is not affiliated with or endorsed by Riot Games.

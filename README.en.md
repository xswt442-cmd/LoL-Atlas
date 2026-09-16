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

## What you can find here

LOL Atlas puts commonly used game references into one clear, searchable interface. Pages and builds can also be shared through their URLs.

- Champion index, search, base stats, abilities, and descriptions
- Item search, stats, recipes, and upgrade paths
- Rune trees, rune slots, and stat shards
- Summoner spell references
- A six-slot build planner with duplicate items and shareable URLs
- URL state for the active module, selected record, search, and build

Data is organized by League patch. Broader LOL Wiki content will be added over time, growing the site into a more complete League knowledge base.

## Technology

The frontend uses TypeScript, React, and Vinext with lightweight static data files, and is deployed on Cloudflare Workers. The project is designed to stay simple to access while making room for Wiki pages, version comparisons, and more lookup tools.

## Development and deployment

```bash
npm ci
npm run dev

npm run deploy          # Production deployment
npm run deploy:preview  # Upload a preview version
```

Application releases and League data releases are tracked separately: application releases use `v*`, while game data releases use `patch-*`.

Pushing a `v*` or `patch-*` tag triggers the `Deploy` workflow: validate the tag, run the full check (`npm run ci`), then publish to the Cloudflare Worker `lol-atlas` with `wrangler deploy`. The custom domain is bound on the Cloudflare side and is untouched by deployments. Branch pushes never deploy; to re-publish an existing release, run `Deploy` manually from the Actions tab and pick the tag.

The workflow needs two repository secrets:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens, created from the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID shown on the right of the Workers overview page in the Cloudflare dashboard |

Add them under Settings → Secrets and variables → Actions → New repository secret, or with `gh secret set CLOUDFLARE_API_TOKEN`.

Repository: [github.com/xswt442-cmd/LoL-Atlas](https://github.com/xswt442-cmd/LoL-Atlas)

Live site: [lol-atlas.xswt.fyi](https://lol-atlas.xswt.fyi)

Data comes from Riot Data Dragon `zh_CN` and Tencent's official CDN. This project is not affiliated with or endorsed by Riot Games.

# LOL Atlas

A data atlas for League of Legends.

LOL Atlas turns versioned Riot and Tencent game data into a searchable, linkable reference for champions, items, runes, summoner spells, and loadouts. The public site is intended for `lol-atlas.xswt.fyi`.

## What is here

- A TypeScript + React atlas UI built with Vinext
- Real patch `16.18.1` data, not demo fixtures
- URL-restorable navigation, search, selected records, and six-slot loadouts
- Versioned release artifacts under `data/releases/<patch>/`
- Node data-contract checks and numeric patch-version tests
- A small Python pipeline package that establishes the migration boundary for acquisition and normalization work

## Local development

Requires Node.js `>=22.13.0` and Python `>=3.12` for pipeline work.

```powershell
npm ci
npm run dev
```

The portable development server listens on `http://localhost:5173` by default.

## Quality gates

```powershell
npm run check
npm run build
python -m pip install -e pipeline
python -m unittest discover -s pipeline/tests
```

`npm run check` runs TypeScript, ESLint, the published-data contract, and Node tests. CI runs the web checks on Windows and Linux, then tests the Python package separately.

## Data layout

```text
public/data/lol.json                  browser payload for the current patch
data/releases/16.18.1/lol.json       immutable JSON release
data/releases/16.18.1/lol.db         immutable SQLite release
data/releases/16.18.1/manifest.json  counts, provenance, sizes, and SHA-256 hashes
data/legacy/versions/*.db            preserved, unpromoted historical snapshots
pipeline/                             acquisition/normalization package boundary
```

A release becomes current only after its manifest and data contract pass. Raw downloads, caches, staging files, and logs are intentionally ignored. Historical SQLite snapshots are preserved under `data/legacy/` until they pass the new normalization rules; in particular, `16.15.1` must have temporary `Jade_*` variants removed before promotion.

## Data sources

The current snapshot combines Riot Data Dragon `zh_CN` data with Tencent's official CDN for localized ability values. League of Legends and its assets are trademarks or registered trademarks of Riot Games. This project is not endorsed by Riot Games.

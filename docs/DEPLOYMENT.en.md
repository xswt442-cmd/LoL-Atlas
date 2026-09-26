# Release and deployment

This is the maintained guide for data patch releases. The root Chinese and English READMEs keep a short summary and link here.

## Release types

| Trigger | Validation | Build artifact | Production deploy | GitHub Release |
| --- | --- | --- | --- | --- |
| Merge to `main` | `npm run ci` | No separately uploaded artifact | Cloudflare Worker | None |
| Push `vX.Y.Z` | Tag must match `package.json` | `dist/` Actions artifact | Cloudflare Worker | Created after a successful deploy; the artifact is not attached as a Release asset |
| Push `patch-X.Y.Z` | Tag must match the patch in `public/data/lol.json`, and CI must pass | Actions artifact for `data/releases/X.Y.Z/` | Cloudflare Worker | None |

The deployment workflow needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. For tagged releases, it uploads the Actions artifact before checking credentials and deploying. The artifact remains available from that Actions run if deployment fails.

## Data patch release

### Prerequisite: a matching SQLite release database

CI requires `data/releases/<version>/lol.db` to match the new snapshot. `pipeline/` can build snapshots and incrementally update an existing database, but this repository does not contain the full raw-data-to-SQLite builder; `pipeline/schema.sql` also notes that the historical database builder is outside this repository. Prepare a database for the target patch with the maintainers' existing builder before continuing. Do not rename an older database and treat it as the new version: the sync tool checks `meta.version`, and the database contains spell cooldown, cost, range, and image fields that are not in the JSON snapshot.

### Build and review the snapshot

Run these commands from the repository root. `<version>` is the new patch, and `<previous>` is the previous snapshot path.

```bash
python -m pip install -e pipeline
lol-atlas-data build-snapshot <version> --previous data/releases/<previous>/lol.json
```

`build-snapshot` writes only `data/releases/<version>/lol.json`; it does not update the site's working snapshot at `public/data/lol.json`. Review its report and complete the manual checks:

- Review spell text that fell back to Data Dragon.
- Add wiki content for new champions.
- Add `categories` for new items.
- Confirm the patch version, balance values, and timeline diff.

Copy the new snapshot into the working snapshot, then run the enrichment scripts. The English blurb script needs the patch's English Data Dragon `championFull.json` in the cache; pinyin initials come from `data/champion-initials.json`.

```bash
mkdir -p data/cache
curl -fsSL "https://ddragon.leagueoflegends.com/cdn/<version>/data/en_US/championFull.json" \
  -o data/cache/en_US_championFull.json
cp data/releases/<version>/lol.json public/data/lol.json
node scripts/enrich-champion-fields.mjs
node scripts/enrich-champion-stats.mjs
```

Both enrichment scripts write `public/data/lol.json` and `data/releases/<version>/lol.json`. `enrich-champion-stats.mjs` fills champion growth values and unit geometry from CommunityDragon; do not skip it.

### Sync the database and validate

Place the matching database at `data/releases/<version>/lol.db`, then sync the fields maintained by the enrichment scripts. This updates selected columns; it does not rebuild the database.

```bash
lol-atlas-data sync-db data/releases/<version>/lol.db public/data/lol.json
lol-atlas-data verify-db data/releases/<version>/lol.db public/data/lol.json
npm run data:normalize
npm run check
python -m unittest discover -s pipeline/tests
```

Run `sync-db` after the JSON is final because it records the snapshot SHA-256 in the database. If `npm run data:normalize` changes the JSON, run `sync-db` and `verify-db` again.

Generate the manifest last. By default, this command reads `public/data/lol.json` and writes to the release directory named by its `meta.version`; confirm that version matches the directory before running it.

```bash
npm run release:manifest
npm run tag:validate -- "patch-<version>"
git status --short
```

Check the manifest's `patch`, file sizes, and SHA-256 values. Confirm that `lol.json`, `lol.db`, and `manifest.json` are all in the new release directory. Commit the data changes before pushing the tag:

```bash
git add public/data/lol.json data/releases/<version>
git commit -m "data(<version>): release patch"
git tag "patch-<version>"
git push origin main
git push origin "patch-<version>"
```

The tag must point to the commit containing the patch data. The workflow runs CI, uploads that release directory as an Actions artifact, and deploys the site. A `patch-*` tag does not create a GitHub Release.

## Application release

An application tag must be `vX.Y.Z` and exactly match the `version` in `package.json`. Commit the code first, then create and push the tag:

```bash
npm run ci
git tag "v<version>"
git push origin "v<version>"
```

The workflow builds the site, uploads `dist/` as an Actions artifact, deploys the Cloudflare Worker, and creates a GitHub Release after a successful deploy. The Actions artifact is not automatically attached to the GitHub Release.

## Known limitation

The full database build for a target patch is outside this repository. A new patch release depends on an external maintainer workflow; until that workflow has reproducible documentation or a script here, this repository alone cannot produce a complete new release directory from upstream data.

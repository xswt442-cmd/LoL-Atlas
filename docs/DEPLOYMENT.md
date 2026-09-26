# 发布与部署

本文是数据补丁发布流程的维护版本。仓库根目录的中英文 README 只保留摘要和本页链接。

## 发布类型

| 触发方式 | 校验 | 构建产物 | 线上发布 | GitHub Release |
| --- | --- | --- | --- | --- |
| 合并到 `main` | `npm run ci` | 无单独上传的 artifact | Cloudflare Worker | 不创建 |
| 推送 `vX.Y.Z` | tag 必须匹配 `package.json` | `dist/` Actions artifact | Cloudflare Worker | 部署成功后创建；artifact 不会附加为 Release asset |
| 推送 `patch-X.Y.Z` | tag 必须匹配 `public/data/lol.json` 的补丁版本，并需要通过 CI | 对应 `data/releases/X.Y.Z/` Actions artifact | Cloudflare Worker | 不创建 |

部署工作流需要 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 两个 repository secret。标签发布先上传 Actions artifact，再检查凭据并部署；因此部署失败时，artifact 仍可从该次 Actions run 下载。

## 数据补丁发布

### 重要前置条件：SQLite 发布库

CI 会要求 `data/releases/<版本>/lol.db` 与新快照匹配。`pipeline/` 提供快照构建和对既有数据库的增量同步，但仓库没有完整的原始数据到 SQLite 的造库程序；`pipeline/schema.sql` 也注明历史造库脚本不在本仓库。开始发布前，必须从维护者现有的造库流程准备目标补丁版本的 `lol.db`。不能把旧版本数据库直接改名后当作新版本库：同步工具会校验数据库的 `meta.version`，而且数据库还包含 JSON 快照没有的技能冷却、消耗、射程和图片等字段。

### 构建和修订快照

以下命令在仓库根目录运行。示例以 `<version>` 表示新补丁号，以 `<previous>` 表示上一版快照路径。

```bash
python -m pip install -e pipeline
lol-atlas-data build-snapshot <version> --previous data/releases/<previous>/lol.json
```

`build-snapshot` 默认只写 `data/releases/<version>/lol.json`，不会更新站点使用的 `public/data/lol.json`。先查看构建报告并完成人工核对：

- 技能文本回退到 Data Dragon 的条目需要人工确认数值。
- 新英雄需要补齐 wiki 内容。
- 新物品需要补齐 `categories`。
- 确认补丁版本、平衡数值和时间线 diff 正确。

将新快照复制到站点工作快照，然后运行补充字段脚本。英文简介脚本需要先把该补丁的英文 Data Dragon `championFull.json` 下载到缓存位置；拼音首字母来自仓库中的 `data/champion-initials.json`。

```bash
mkdir -p data/cache
curl -fsSL "https://ddragon.leagueoflegends.com/cdn/<version>/data/en_US/championFull.json" \
  -o data/cache/en_US_championFull.json
cp data/releases/<version>/lol.json public/data/lol.json
node scripts/enrich-champion-fields.mjs
node scripts/enrich-champion-stats.mjs
```

这两个补充脚本会同时写入 `public/data/lol.json` 和 `data/releases/<version>/lol.json`。`enrich-champion-stats.mjs` 会从 CommunityDragon 补英雄成长值和单位几何；该步骤不可跳过。

### 同步数据库并验证

把与目标补丁匹配的数据库放到 `data/releases/<version>/lol.db` 后，再同步快照中的字段。此工具只更新补丁脚本维护的列，不会重建数据库。

```bash
lol-atlas-data sync-db data/releases/<version>/lol.db public/data/lol.json
lol-atlas-data verify-db data/releases/<version>/lol.db public/data/lol.json
npm run data:normalize
npm run check
python -m unittest discover -s pipeline/tests
```

`sync-db` 必须在 JSON 最终修改之后运行，因为它会把快照 SHA-256 写入数据库。若 `npm run data:normalize` 改动了 JSON，需再次运行 `sync-db` 和 `verify-db`。

最后生成 manifest。命令默认读取 `public/data/lol.json`，并据其 `meta.version` 写入对应发布目录；运行前确认该版本与目录一致。

```bash
npm run release:manifest
npm run tag:validate -- "patch-<version>"
git status --short
```

检查 manifest 中的 `patch`、文件大小和 SHA-256；确认 `lol.json`、`lol.db`、`manifest.json` 都位于新版本目录。提交数据变更后再推送标签：

```bash
git add public/data/lol.json data/releases/<version>
git commit -m "data(<version>): release patch"
git tag "patch-<version>"
git push origin main
git push origin "patch-<version>"
```

标签必须指向包含该补丁数据的提交。工作流会运行 CI、上传该版本目录为 Actions artifact，并发布站点。`patch-*` 标签不会创建 GitHub Release。

## 应用版本发布

应用版本 tag 必须是 `vX.Y.Z`，且与 `package.json` 的 `version` 完全一致。先提交对应代码，再创建并推送标签：

```bash
npm run ci
git tag "v<version>"
git push origin "v<version>"
```

工作流会构建站点、上传 `dist/` Actions artifact、部署 Cloudflare Worker，并在部署成功后创建 GitHub Release。上传的 Actions artifact 不会自动作为 GitHub Release 附件。

## 当前发布流程的已知限制

目标版本 SQLite 数据库的完整造库步骤不在本仓库。新补丁发布依赖仓库外的维护流程；在该流程有明确、可复现的文档或脚本之前，不能只靠本仓库从上游数据生成完整的新版本发布目录。

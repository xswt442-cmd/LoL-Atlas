"""发布数据的命令行入口：查看版本、同步 sqlite 库。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .db_sync import sync_release_database, verify_release_database
from .versions import latest_patch
from .normalize import normalize_sqlite_item_tiers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lol-atlas-data")
    subparsers = parser.add_subparsers(dest="command", required=True)
    latest = subparsers.add_parser("latest", help="打印版本号最大的发布目录")
    latest.add_argument("releases", nargs="?", default="data/releases", type=Path)
    inspect = subparsers.add_parser("inspect", help="打印精简后的发布 manifest")
    inspect.add_argument("manifest", type=Path)
    normalize = subparsers.add_parser("normalize-sqlite", help="按最终装备图重新计算分级")
    normalize.add_argument("database", type=Path)
    sync = subparsers.add_parser(
        "sync-db",
        help="把快照里补丁脚本新增的字段同步进发布库（不做全量重建，见 db_sync 模块说明）",
    )
    sync.add_argument("database", type=Path)
    sync.add_argument("snapshot", type=Path, help="public/data/lol.json")
    verify = subparsers.add_parser("verify-db", help="只核对库与快照的补丁字段是否一致")
    verify.add_argument("database", type=Path)
    verify.add_argument("snapshot", type=Path)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "latest":
        versions = [entry.name for entry in args.releases.iterdir() if entry.is_dir()]
        value = latest_patch(versions)
        if value is None:
            raise SystemExit("no release directories found")
        print(value)
        return
    if args.command == "inspect":
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        print(json.dumps({"patch": manifest["patch"], "counts": manifest["counts"]}, ensure_ascii=False))
        return
    if args.command in ("sync-db", "verify-db"):
        if args.command == "sync-db":
            report = sync_release_database(args.database, args.snapshot)
            for column in report.added_columns:
                print(f"  新增列 {column}")
            for column, count in sorted(report.updated_columns.items()):
                print(f"  {column}: 写入 {count} 行")
            print(f"共更新 {report.updated_rows} 个英雄" + ("" if report.wrote else "（无变化，未写文件）"))
        else:
            report = verify_release_database(args.database, args.snapshot)
            for column in report.added_columns:
                print(f"  库缺列 {column}")
        if report.drift:
            print(f"发现 {len(report.drift)} 处不一致：")
            for line in report.drift[:10]:
                print(f"  {line}")
            raise SystemExit(1)
        print("库与快照一致")
        return
    changed = normalize_sqlite_item_tiers(args.database)
    print(f"normalized {changed} item tiers")


if __name__ == "__main__":
    main()

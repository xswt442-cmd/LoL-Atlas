"""Small, cross-platform entry point for release inspection."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .versions import latest_patch
from .normalize import normalize_sqlite_item_tiers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lol-atlas-data")
    subparsers = parser.add_subparsers(dest="command", required=True)
    latest = subparsers.add_parser("latest", help="print the newest numeric patch directory")
    latest.add_argument("releases", nargs="?", default="data/releases", type=Path)
    inspect = subparsers.add_parser("inspect", help="print the compact release manifest")
    inspect.add_argument("manifest", type=Path)
    normalize = subparsers.add_parser("normalize-sqlite", help="recalculate tiers from the final item graph")
    normalize.add_argument("database", type=Path)
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
    changed = normalize_sqlite_item_tiers(args.database)
    print(f"normalized {changed} item tiers")


if __name__ == "__main__":
    main()

"""Patch-version parsing that never relies on lexicographic sorting."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable

_PATCH_PATTERN = re.compile(r"^(\d+)\.(\d+)(?:\.(\d+))?$")


@dataclass(frozen=True, order=True)
class PatchVersion:
    major: int
    minor: int
    revision: int = 0

    @classmethod
    def parse(cls, value: str) -> "PatchVersion":
        match = _PATCH_PATTERN.fullmatch(value)
        if match is None:
            raise ValueError(f"invalid patch version: {value}")
        major, minor, revision = match.groups()
        return cls(int(major), int(minor), int(revision or 0))

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.revision}"


def latest_patch(values: Iterable[str]) -> str | None:
    versions = list(values)
    if not versions:
        return None
    return max(versions, key=PatchVersion.parse)

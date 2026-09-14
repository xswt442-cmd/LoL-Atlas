const PATCH_PATTERN = /^(\d+)\.(\d+)(?:\.(\d+))?$/;

export function parsePatchVersion(value) {
  const match = PATCH_PATTERN.exec(value);
  if (!match) throw new TypeError(`Invalid patch version: ${value}`);
  return match.slice(1).map((part) => Number(part ?? 0));
}

export function comparePatchVersions(left, right) {
  const a = parsePatchVersion(left);
  const b = parsePatchVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function latestPatchVersion(versions) {
  if (!versions.length) return null;
  return versions.reduce((latest, value) => comparePatchVersions(value, latest) > 0 ? value : latest);
}

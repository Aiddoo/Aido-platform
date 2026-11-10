export const semanticVersionPattern =
  "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$";

const semanticVersionRegExp = new RegExp(semanticVersionPattern);
const numericIdentifierRegExp = /^\d+$/;

interface ParsedSemanticVersion {
  readonly core: readonly [number, number, number];
  readonly prereleaseIdentifiers: readonly string[];
}

function parseSemanticVersion(version: string | null | undefined): ParsedSemanticVersion | null {
  if (!version) {
    return null;
  }

  const match = semanticVersionRegExp.exec(version);
  if (!match) {
    return null;
  }

  const [, major = "0", minor = "0", patch = "0"] = match;
  const [versionWithoutBuild = ""] = version.split("+", 1);
  const prereleaseStart = versionWithoutBuild.indexOf("-");
  return {
    core: [Number(major), Number(minor), Number(patch)],
    prereleaseIdentifiers:
      prereleaseStart === -1 ? [] : versionWithoutBuild.slice(prereleaseStart + 1).split("."),
  };
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const isLeftNumeric = numericIdentifierRegExp.test(left);
  const isRightNumeric = numericIdentifierRegExp.test(right);
  if (isLeftNumeric && isRightNumeric) {
    return Number(left) - Number(right);
  }
  if (isLeftNumeric) {
    return -1;
  }
  if (isRightNumeric) {
    return 1;
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  if (left.length === 0) {
    return 1;
  }
  if (right.length === 0) {
    return -1;
  }

  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = comparePrereleaseIdentifier(left[index] ?? "", right[index] ?? "");
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
}

/**
 * Compares two versions by SemVer 2.0.0 precedence: build metadata is ignored and a prerelease
 * sorts before its release. Returns null when either side is not a valid semantic version.
 */
export function compareSemanticVersions(
  left: string | null | undefined,
  right: string | null | undefined,
): number | null {
  const parsedLeft = parseSemanticVersion(left);
  const parsedRight = parseSemanticVersion(right);
  if (!parsedLeft || !parsedRight) {
    return null;
  }

  for (let index = 0; index < parsedLeft.core.length; index += 1) {
    const difference = (parsedLeft.core[index] ?? 0) - (parsedRight.core[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return comparePrerelease(parsedLeft.prereleaseIdentifiers, parsedRight.prereleaseIdentifiers);
}

export function isSemanticVersionAtLeast(
  version: string | null | undefined,
  minimumVersion: string,
): boolean {
  const difference = compareSemanticVersions(version, minimumVersion);
  return difference != null && difference >= 0;
}

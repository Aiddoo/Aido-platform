import {
  type FeatureCampaignConfig,
  featureCampaignAppVersionSchema,
} from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { type Instant, diffMs, toEpochMs } from '@src/shared/date/instant';

import { WHATS_NEW_REENTRY_WINDOW_MS } from '../constants/whats-new.constants';
import type { Release, ReleaseList } from '../schemas/release.schema';

interface ParsedSemanticVersion {
  core: readonly [number, number, number];
  prerelease: readonly string[] | null;
}

interface AutoOpenInput {
  config: FeatureCampaignConfig | undefined;
  user: Pick<User, 'createdAt'> | undefined;
  appVersion: string | undefined;
  hasSeen: boolean;
}

function parseSemanticVersion(value: string | undefined): ParsedSemanticVersion | null {
  if (!value || !featureCampaignAppVersionSchema.safeParse(value).success) {
    return null;
  }

  const withoutBuild = value.split('+', 1)[0];
  if (!withoutBuild) {
    return null;
  }

  const prereleaseSeparatorIndex = withoutBuild.indexOf('-');
  const corePart =
    prereleaseSeparatorIndex === -1
      ? withoutBuild
      : withoutBuild.slice(0, prereleaseSeparatorIndex);
  const prereleasePart =
    prereleaseSeparatorIndex === -1 ? undefined : withoutBuild.slice(prereleaseSeparatorIndex + 1);
  if (!corePart) {
    return null;
  }
  const coreIdentifiers = corePart.split('.').map(Number);
  if (coreIdentifiers.length !== 3) {
    return null;
  }

  return {
    core: [coreIdentifiers[0] ?? 0, coreIdentifiers[1] ?? 0, coreIdentifiers[2] ?? 0],
    prerelease: prereleasePart ? prereleasePart.split('.') : null,
  };
}

function comparePrerelease(
  current: readonly string[] | null,
  minimum: readonly string[] | null,
): number {
  if (current == null && minimum == null) {
    return 0;
  }
  if (current == null) {
    return 1;
  }
  if (minimum == null) {
    return -1;
  }

  const length = Math.max(current.length, minimum.length);
  for (let index = 0; index < length; index += 1) {
    const currentIdentifier = current[index];
    const minimumIdentifier = minimum[index];

    if (currentIdentifier == null) {
      return -1;
    }
    if (minimumIdentifier == null) {
      return 1;
    }
    if (currentIdentifier === minimumIdentifier) {
      continue;
    }

    const currentIsNumeric = /^\d+$/.test(currentIdentifier);
    const minimumIsNumeric = /^\d+$/.test(minimumIdentifier);
    if (currentIsNumeric && minimumIsNumeric) {
      return Number(currentIdentifier) - Number(minimumIdentifier);
    }
    if (currentIsNumeric) {
      return -1;
    }
    if (minimumIsNumeric) {
      return 1;
    }
    return currentIdentifier < minimumIdentifier ? -1 : 1;
  }

  return 0;
}

export function isSemanticVersionAtLeast(
  appVersion: string | undefined,
  minVersion: string,
): boolean {
  const current = parseSemanticVersion(appVersion);
  const minimum = parseSemanticVersion(minVersion);
  if (!current || !minimum) {
    return false;
  }

  for (let index = 0; index < current.core.length; index += 1) {
    const difference = (current.core[index] ?? 0) - (minimum.core[index] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }

  return comparePrerelease(current.prerelease, minimum.prerelease) >= 0;
}

/** 서버가 켠 캠페인을 앱이 묶어 온 출시로 찾는다. 앱이 모르는 캠페인이면 없다 */
function findReleaseByCampaign<T extends Pick<Release, 'campaignId'>>(
  releases: readonly T[],
  campaignId: string,
): T | undefined {
  return releases.find((release) => release.campaignId === campaignId);
}

function getLatestRelease<T extends Pick<Release, 'releasedOn'>>(
  releases: readonly [T, ...T[]],
): T {
  return releases.reduce((latest, release) =>
    release.releasedOn > latest.releasedOn ? release : latest,
  );
}

function isReleaseAvailable(
  release: Pick<Release, 'requiresInvite'>,
  { isInviteAvailable }: { isInviteAvailable: boolean },
): boolean {
  return !release.requiresInvite || isInviteAvailable;
}

/** 출시 전에 가입했고, 켜진 캠페인을 지원하는 앱이고, 아직 보지 않았을 때만 자동으로 연다 */
function canAutoOpen({ config, user, appVersion, hasSeen }: AutoOpenInput): boolean {
  if (!config?.enabled || user == null) {
    return false;
  }

  return (
    config.autoOpen &&
    !hasSeen &&
    user.createdAt.getTime() < toEpochMs(config.launchedAt) &&
    isSemanticVersionAtLeast(appVersion, config.minAppVersion)
  );
}

/** 현재 시각은 분 단위 시계라 방금 연 시각보다 앞설 수 있다. 그래도 바로 보이도록 아래 경계를 두지 않는다 */
function isReentryVisible(openedAt: Instant | null, now: Instant): boolean {
  return openedAt != null && diffMs(now, openedAt) < WHATS_NEW_REENTRY_WINDOW_MS;
}

/** 지난 출시까지 점으로 남기면 오래 사라지지 않으므로 최신 출시만 본다 */
function hasUnseenRelease(releases: ReleaseList, seenCampaignIds: readonly string[]): boolean {
  return !seenCampaignIds.includes(getLatestRelease(releases).campaignId);
}

export const WhatsNewPolicy = {
  canAutoOpen,
  findReleaseByCampaign,
  getLatestRelease,
  hasUnseenRelease,
  isReentryVisible,
  isReleaseAvailable,
} as const;

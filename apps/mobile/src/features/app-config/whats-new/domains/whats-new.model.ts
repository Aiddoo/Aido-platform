import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { type Instant, diffMs, toEpochMs } from '@src/shared/date/instant';
import { isSemanticVersionAtLeast } from '@src/shared/utils/semantic-version';
import { maxBy } from 'es-toolkit';

import { WHATS_NEW_REENTRY_WINDOW_MS } from '../constants/whats-new.constants';
import type { Release, ReleaseList } from '../schemas/release.schema';

interface AutoOpenInput {
  config: FeatureCampaignConfig | undefined;
  user: Pick<User, 'createdAt'> | undefined;
  appVersion: string | undefined;
  hasSeen: boolean;
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
  return maxBy(releases, (release) => Date.parse(release.releasedOn));
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
    toEpochMs(user.createdAt) < toEpochMs(config.launchedAt) &&
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

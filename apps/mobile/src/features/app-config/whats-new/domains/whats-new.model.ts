import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/domains/feature-campaign.model';
import type { User } from '@src/features/identity/user/domains/user.model';
import { type Instant, diffMs, toEpochMs } from '@src/shared/date/instant';
import { isSemanticVersionAtLeast } from '@src/shared/utils/semantic-version';
import { maxBy } from 'es-toolkit';
import { z } from 'zod';

import { RELEASE_ID, WHATS_NEW_REENTRY_WINDOW_MS } from '../constants/whats-new.constants';

export const releaseIdSchema = z.enum(RELEASE_ID);
export type ReleaseId = z.infer<typeof releaseIdSchema>;

export const releaseSchema = z.object({
  id: releaseIdSchema,
  campaignId: z.string().min(1),
  releasedOn: z.iso.date(),
  requiresInvite: z.boolean(),
});
export type Release = z.infer<typeof releaseSchema>;

interface AutoOpenInput {
  config: FeatureCampaignConfig | undefined;
  user: Pick<User, 'createdAt'> | undefined;
  appVersion: string | undefined;
  hasSeen: boolean;
}

/** 서버가 켠 캠페인을 앱이 묶어 온 출시로 찾는다. 앱이 모르는 캠페인이면 없다 */
function findReleaseByCampaign<T extends Release>(
  releases: readonly T[],
  campaignId: string,
): T | null {
  return releases.find((release) => release.campaignId === campaignId) ?? null;
}

function getLatestRelease<T extends Release>(releases: readonly [T, ...T[]]): T {
  return maxBy(releases, (release) => Date.parse(release.releasedOn));
}

function canViewRelease(
  release: Release,
  { isInviteAvailable }: { isInviteAvailable: boolean },
): boolean {
  return !release.requiresInvite || isInviteAvailable;
}

/** 출시 전에 가입했고, 켜진 캠페인을 지원하는 앱이고, 아직 보지 않았을 때만 자동으로 연다 */
function shouldAutoOpen({ config, user, appVersion, hasSeen }: AutoOpenInput): boolean {
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
function shouldShowReentry(openedAt: Instant | null, now: Instant): boolean {
  return openedAt != null && diffMs(now, openedAt) < WHATS_NEW_REENTRY_WINDOW_MS;
}

export const WhatsNewPolicy = {
  shouldAutoOpen,
  findReleaseByCampaign,
  getLatestRelease,
  shouldShowReentry,
  canViewRelease,
} as const;

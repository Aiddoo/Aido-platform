import { DAY_MS } from '@src/shared/constants/time-units';
import { type Instant, diffMs } from '@src/shared/date/instant';
import { isSemanticVersionAtLeast } from '@src/shared/utils/semantic-version';
import { maxBy } from 'es-toolkit';
import { z } from 'zod';

import type { WhatsNewCampaignConfig } from './whats-new-campaign.model';

/** 목록 줄의 route·지표 키. 기능 출시마다 하나씩 쌓고 지우지 않는다(코드의 이름은 constants의 RELEASE_ID) */
const releaseIdSchema = z.enum(['1.15.0', '1.14.0']);
export type ReleaseId = z.infer<typeof releaseIdSchema>;

/** 여러 단계 소개를 앱에 남긴 출시. 최근 두 출시만이고 최신이 앞이다 */
const TOUR_RELEASE_IDS = ['1.15.0', '1.14.0'] as const satisfies readonly ReleaseId[];
export const tourReleaseIdSchema = z.enum(TOUR_RELEASE_IDS);
type TourReleaseId = z.infer<typeof tourReleaseIdSchema>;

/** 처음 본 뒤 피드 카드로 다시 열 수 있는 기간 */
const REENTRY_WINDOW_MS = 14 * DAY_MS;

/** 소개 출시를 모르는 route는 최신 소개를 연다 */
export function getLatestTourReleaseId(): TourReleaseId {
  return TOUR_RELEASE_IDS[0];
}

export const releaseSchema = z.object({
  id: releaseIdSchema,
  /** 서버가 자동으로 열 수 있는 출시에만 있다. 지난 출시는 목록에서만 연다 */
  campaignId: z.string().min(1).optional(),
  releasedOn: z.iso.date(),
  /** 초대가 꺼져 있으면 쓸 수 없는 기능이라 목록에서 숨긴다 */
  requiresInvite: z.boolean(),
});
export type Release = z.infer<typeof releaseSchema>;

interface AutoOpenContext {
  config: WhatsNewCampaignConfig | undefined;
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

/** 목록은 지금 쓸 수 있는 기능만 보인다. 쓸 수 없는 기능은 누를 수 없게 두지 않고 숨긴다 */
function canViewRelease(
  release: Release,
  { isInviteAvailable }: { isInviteAvailable: boolean },
): boolean {
  return !release.requiresInvite || isInviteAvailable;
}

/** 최근 두 출시만 여러 단계 소개가 있다. 없으면 목록 줄은 바로 해 보기로 이어진다 */
function findTourId(release: Release): TourReleaseId | null {
  const parsed = tourReleaseIdSchema.safeParse(release.id);
  return parsed.success ? parsed.data : null;
}

/** 서버가 이 출시의 캠페인과 자동 열기를 켰고, 지원하는 앱이고, 아직 보지 않았으면 연다. 가입 시점은 보지 않아 새 계정도 한 번 본다 */
function shouldAutoOpen(
  release: Release,
  { config, appVersion, hasSeen }: AutoOpenContext,
): boolean {
  if (config == null || !config.enabled) {
    return false;
  }

  return (
    config.campaignId === release.campaignId &&
    config.autoOpen &&
    !hasSeen &&
    isSemanticVersionAtLeast(appVersion, config.minAppVersion)
  );
}

/** 현재 시각은 분 단위 시계라 방금 연 시각보다 앞설 수 있다. 그래도 바로 보이도록 아래 경계를 두지 않는다 */
function shouldShowReentry(openedAt: Instant | null, now: Instant): boolean {
  return openedAt != null && diffMs(now, openedAt) < REENTRY_WINDOW_MS;
}

export const WhatsNewPolicy = {
  shouldAutoOpen,
  canViewRelease,
  findReleaseByCampaign,
  findTourId,
  getLatestRelease,
  shouldShowReentry,
} as const;

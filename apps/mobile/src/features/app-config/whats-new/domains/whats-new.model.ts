import { isSemanticVersionAtLeast } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time-units';
import { dateKeySchema } from '@src/shared/date/date-key';
import { type Instant, diffMs } from '@src/shared/date/instant';
import { z } from 'zod';

import type { WhatsNewCampaignConfig } from './whats-new-campaign.model';

/** 목록 줄의 route·지표 키(코드의 이름은 constants의 RELEASE_ID). 지운 친구 초대 줄의 1.14.0은 지표 기록에 남아 다시 쓰지 않는다 */
const releaseIdSchema = z.enum(['1.15.0']);
export type ReleaseId = z.infer<typeof releaseIdSchema>;

/** 여러 단계 소개를 앱에 남긴 출시. 최근 두 출시만이고 최신이 앞이다 */
const TOUR_RELEASE_IDS = ['1.15.0'] as const satisfies readonly ReleaseId[];
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
  releasedOn: dateKeySchema,
});
export type Release = z.infer<typeof releaseSchema>;

interface AutoOpenContext {
  config: WhatsNewCampaignConfig | undefined;
  appVersion: string | null;
  hasSeen: boolean;
}

/** 서버가 켠 캠페인을 앱이 묶어 온 출시로 찾는다. 앱이 모르는 캠페인이면 없다 */
export function findReleaseByCampaign<T extends Release>(
  releases: readonly T[],
  campaignId: string,
): T | null {
  return releases.find((release) => release.campaignId === campaignId) ?? null;
}

/** DateKey(YYYY-MM-DD)는 사전순이 날짜순이라 Date로 바꾸지 않고 비교한다 */
export function getLatestRelease<T extends Release>(releases: readonly [T, ...T[]]): T {
  return releases.reduce((latest, release) =>
    release.releasedOn > latest.releasedOn ? release : latest,
  );
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
export function shouldShowReentry(openedAt: Instant | null, now: Instant): boolean {
  return openedAt != null && diffMs(now, openedAt) < REENTRY_WINDOW_MS;
}

export const WhatsNewPolicy = {
  shouldAutoOpen,
  findTourId,
} as const;

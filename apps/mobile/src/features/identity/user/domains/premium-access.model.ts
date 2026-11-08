import { PREMIUM_GRANT_ENDING_NOTICE_DAYS, PREMIUM_SOURCE } from '@aido/api/vocabulary';
import {
  calculateCalendarDaysLeft,
  hasInstantPassed,
  type Instant,
  instantSchema,
  toEpochMs,
} from '@src/shared/date/instant';
import { z } from 'zod';

export const premiumAccessSchema = z.object({
  source: z.enum(PREMIUM_SOURCE).nullable(),
  /** 쌓아 둔 보상까지 모두 이어 붙인 프리미엄의 끝(서버 premiumEndsAt) */
  endsAt: instantSchema.nullable(),
  /** 지금 출처(스토어 구독 또는 진행 중인 보상 기간)만 끝나는 시각(서버 premiumPeriodEndsAt) */
  periodEndsAt: instantSchema.nullable(),
  willRenew: z.boolean(),
  /** 지금 기간이 끝난 뒤 받은 순서대로 이어서 시작하는 보상 일수. 출처와 상관없이 있을 수 있다 */
  bankedDays: z.int().nonnegative(),
  /** 프리미엄이 아닐 때 최근 PREMIUM_GRANT_ENDED_WINDOW_DAYS일 안에 끝난 마지막 보상 기간의 끝. 그 뒤로는 서버가 null로 보낸다 */
  grantEndedAt: instantSchema.nullable(),
});
export type PremiumAccess = z.infer<typeof premiumAccessSchema>;

function isWithinNoticeDays(daysLeft: number, noticeDays: number) {
  return daysLeft <= noticeDays;
}

/** 스토어 구독으로 프리미엄을 쓰는 중이라 구독을 다시 권하지 않는다 */
function isStoreSubscribed(access: Pick<PremiumAccess, 'source'>) {
  return access.source === PREMIUM_SOURCE.STORE;
}

function isGrantOnly(access: Pick<PremiumAccess, 'source'>) {
  return access.source === PREMIUM_SOURCE.GRANT;
}

function hasBankedDays(access: Pick<PremiumAccess, 'bankedDays'>) {
  return access.bankedDays > 0;
}

/** 자동 갱신되거나 이어서 받을 보상이 있으면 전체 프리미엄은 아직 끝나지 않는다 */
function hasRenewal(access: Pick<PremiumAccess, 'willRenew' | 'bankedDays'>) {
  return access.willRenew || hasBankedDays(access);
}

function getDaysLeft(access: Pick<PremiumAccess, 'endsAt'>, now: Instant, timeZone: string) {
  return access.endsAt == null ? null : calculateCalendarDaysLeft(access.endsAt, now, timeZone);
}

/** 곧 끝나는데 이어질 길이 없는지. 이미 끝난 시각이면 곧 만료가 아니라 만료다 */
function isExpiringSoon(
  access: Pick<PremiumAccess, 'endsAt' | 'willRenew' | 'bankedDays'>,
  now: Instant,
  timeZone: string,
) {
  const daysLeft = getDaysLeft(access, now, timeZone);
  if (access.endsAt == null || daysLeft == null) {
    return false;
  }

  return (
    !hasRenewal(access) &&
    !hasInstantPassed(access.endsAt, now) &&
    isWithinNoticeDays(daysLeft, PREMIUM_GRANT_ENDING_NOTICE_DAYS)
  );
}

/** 무료 페이월에서 "초대 보상 프리미엄이 끝났어요"를 붙일 시각. 아직 프리미엄이면 null이다 */
function getRecentGrantEndedAt(access: Pick<PremiumAccess, 'source' | 'grantEndedAt'>) {
  return access.source == null ? access.grantEndedAt : null;
}

/**
 * 지난 확인 뒤 지금까지 사이에 지금 기간이나 전체 프리미엄이 끝났는지. 끝나는 순간에는 서버 이벤트가 없어
 * 앱이 켜져 있으면 내 정보를 다시 받아야 한다. 경계는 남은 일수 표시(hasInstantPassed)와 같이 끝나는 시각 자체를 포함한다
 */
function hasEndedSince(
  access: Pick<PremiumAccess, 'periodEndsAt' | 'endsAt'>,
  lastCheckedAt: Instant,
  now: Instant,
) {
  return [access.periodEndsAt, access.endsAt].some(
    (endsAt) =>
      endsAt != null && !hasInstantPassed(endsAt, lastCheckedAt) && hasInstantPassed(endsAt, now),
  );
}

function isSameInstant(a: Instant | null, b: Instant | null) {
  return a === b || (a != null && b != null && toEpochMs(a) === toEpochMs(b));
}

/** 서버가 다시 계산한 값이 하나라도 바뀌면 한도·사용량 같은 프리미엄 의존 데이터도 달라진다 */
function hasChanged(previous: PremiumAccess, next: PremiumAccess) {
  return (
    previous.source !== next.source ||
    !isSameInstant(previous.endsAt, next.endsAt) ||
    !isSameInstant(previous.periodEndsAt, next.periodEndsAt) ||
    previous.willRenew !== next.willRenew ||
    previous.bankedDays !== next.bankedDays
  );
}

export const PremiumAccessPolicy = {
  isStoreSubscribed,
  isGrantOnly,
  hasBankedDays,
  getDaysLeft,
  isExpiringSoon,
  getRecentGrantEndedAt,
  hasEndedSince,
  hasChanged,
} as const;

import { PREMIUM_GRANT_ENDING_NOTICE_DAYS, PREMIUM_SOURCE } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time.constants';
import { type Instant, toDateKey, toEpochMs } from '@src/shared/date/instant';

import type { PremiumAccess } from '../schemas/premium-access.schema';

// 같은 시간대의 달력 날짜끼리 비교해야 DST로 하루가 23·25시간인 날에도 하루씩 줄어든다
function toCalendarDayNumber(instant: Instant, timeZone: string) {
  return Date.parse(`${toDateKey(instant, timeZone)}T00:00:00Z`) / DAY_MS;
}

/** 끝나는 날까지 남은 달력 일수. 이미 지난 날은 0일이다 */
export function calculateDaysLeft(endsAt: Instant, now: Instant, timeZone: string) {
  return Math.max(toCalendarDayNumber(endsAt, timeZone) - toCalendarDayNumber(now, timeZone), 0);
}

export function hasPassed(endsAt: Instant, now: Instant) {
  return toEpochMs(endsAt) <= toEpochMs(now);
}

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
  return access.endsAt == null ? null : calculateDaysLeft(access.endsAt, now, timeZone);
}

/** 곧 끝나는데 이어질 길이 없는지. 이미 끝난 시각이면 곧 만료가 아니라 만료다 */
function isExpiringSoon(
  access: Pick<PremiumAccess, 'endsAt' | 'willRenew' | 'bankedDays'>,
  now: Instant,
  timeZone: string,
) {
  const daysLeft = getDaysLeft(access, now, timeZone);

  return (
    access.endsAt != null &&
    daysLeft != null &&
    !hasRenewal(access) &&
    !hasPassed(access.endsAt, now) &&
    isWithinNoticeDays(daysLeft, PREMIUM_GRANT_ENDING_NOTICE_DAYS)
  );
}

/** 무료 페이월에서 "초대 보상 프리미엄이 끝났어요"를 붙일 시각. 아직 프리미엄이면 null이다 */
function getRecentGrantEndedAt(access: Pick<PremiumAccess, 'source' | 'grantEndedAt'>) {
  return access.source == null ? access.grantEndedAt : null;
}

/**
 * 지난 확인 뒤 지금까지 사이에 지금 기간이나 전체 프리미엄이 끝났는지. 끝나는 순간에는 서버 이벤트가 없어
 * 앱이 켜져 있으면 내 정보를 다시 받아야 한다. 경계는 남은 일수 표시(hasPassed)와 같이 끝나는 시각 자체를 포함한다
 */
function hasEndedSince(
  access: Pick<PremiumAccess, 'periodEndsAt' | 'endsAt'>,
  lastCheckedAt: Instant,
  now: Instant,
) {
  return [access.periodEndsAt, access.endsAt].some(
    (endsAt) => endsAt != null && !hasPassed(endsAt, lastCheckedAt) && hasPassed(endsAt, now),
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

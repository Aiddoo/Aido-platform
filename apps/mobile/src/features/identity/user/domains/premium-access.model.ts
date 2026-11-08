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
  endsAt: instantSchema.nullable(),
  periodEndsAt: instantSchema.nullable(),
  willRenew: z.boolean(),
  bankedDays: z.int().nonnegative(),
  grantEndedAt: instantSchema.nullable(),
});
export type PremiumAccess = z.infer<typeof premiumAccessSchema>;

function isWithinNoticeDays(daysLeft: number, noticeDays: number) {
  return daysLeft <= noticeDays;
}

function isStoreSubscribed(access: Pick<PremiumAccess, 'source'>) {
  return access.source === PREMIUM_SOURCE.STORE;
}

function isGrantOnly(access: Pick<PremiumAccess, 'source'>) {
  return access.source === PREMIUM_SOURCE.GRANT;
}

function hasBankedDays(access: Pick<PremiumAccess, 'bankedDays'>) {
  return access.bankedDays > 0;
}

function hasRenewal(access: Pick<PremiumAccess, 'willRenew' | 'bankedDays'>) {
  return access.willRenew || hasBankedDays(access);
}

function getDaysLeft(access: Pick<PremiumAccess, 'endsAt'>, now: Instant, timeZone: string) {
  return access.endsAt == null ? null : calculateCalendarDaysLeft(access.endsAt, now, timeZone);
}

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

function getRecentGrantEndedAt(access: Pick<PremiumAccess, 'source' | 'grantEndedAt'>) {
  return access.source == null ? access.grantEndedAt : null;
}

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

import { premiumSourceSchema } from '@aido/api';
import { formatDateKey } from '@src/shared/utils/date-format';
import { z } from 'zod';

/** 끝나기 며칠 전부터 안내할지 (서버 PREMIUM_GRANT_ENDING 푸시와 같은 하루 전) */
const PREMIUM_ENDING_NOTICE_DAYS = 1;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const PremiumAccessSchema = z.object({
  source: premiumSourceSchema.nullable(),
  endsAt: z.date().nullable(),
  willRenew: z.boolean(),
  /** 스토어 구독 중이라 아직 시작하지 않은 보상 일수. 구독이 끝나면 이어서 시작한다 */
  bankedDays: z.number().int().nonnegative(),
});

export type PremiumAccess = z.infer<typeof PremiumAccessSchema>;

// 같은 시간대의 달력 날짜끼리 비교해야 DST로 하루가 23·25시간인 날에도 하루씩 줄어든다
function toCalendarDayNumber(date: Date, timeZone: string) {
  return Date.parse(`${formatDateKey(date, timeZone)}T00:00:00Z`) / DAY_IN_MS;
}

/** 끝나는 날까지 남은 달력 일수. 이미 지난 날은 0일이다 */
export function calculateDaysLeft(endsAt: Date, now: Date, timeZone: string) {
  return Math.max(toCalendarDayNumber(endsAt, timeZone) - toCalendarDayNumber(now, timeZone), 0);
}

export function hasPassed(endsAt: Date, now: Date) {
  return endsAt.getTime() <= now.getTime();
}

export function isWithinNoticeDays(daysLeft: number, noticeDays: number) {
  return daysLeft <= noticeDays;
}

export const PremiumAccessPolicy = {
  isGrantOnly(access: PremiumAccess) {
    return access.source === 'GRANT';
  },

  hasBankedDays(access: PremiumAccess) {
    return access.bankedDays > 0;
  },

  // 보상 기간만 있고 스토어 결제가 가능할 때만 끝나기 전에 구독을 이어 붙일 수 있다
  canSubscribeAfterGrant(access: PremiumAccess, isStoreConfigured: boolean) {
    return this.isGrantOnly(access) && isStoreConfigured;
  },

  daysLeft(access: PremiumAccess, now: Date, timeZone: string) {
    return access.endsAt == null ? null : calculateDaysLeft(access.endsAt, now, timeZone);
  },

  isEndingSoon(access: PremiumAccess, now: Date, timeZone: string) {
    const daysLeft = this.daysLeft(access, now, timeZone);
    if (access.endsAt == null || daysLeft == null || access.willRenew) {
      return false;
    }

    return (
      !hasPassed(access.endsAt, now) && isWithinNoticeDays(daysLeft, PREMIUM_ENDING_NOTICE_DAYS)
    );
  },

  isEndingToday(access: PremiumAccess, now: Date, timeZone: string) {
    return this.isEndingSoon(access, now, timeZone) && this.daysLeft(access, now, timeZone) === 0;
  },
};

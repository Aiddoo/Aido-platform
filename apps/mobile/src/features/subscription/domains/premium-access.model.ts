import { premiumSourceSchema } from '@aido/api';
import { formatDateKey } from '@src/shared/utils/date-format';
import { z } from 'zod';

/** 끝나기 며칠 전부터 안내할지 (서버 PREMIUM_GRANT_ENDING 푸시와 같은 하루 전) */
const PREMIUM_ENDING_NOTICE_DAYS = 1;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const PremiumAccessSchema = z.object({
  source: premiumSourceSchema.nullable(),
  /** 이어서 받을 보상까지 모두 이어 붙인 프리미엄의 끝 */
  endsAt: z.date().nullable(),
  /** 지금 출처(스토어 구독 또는 보상 기간)가 끝나는 시각 */
  periodEndsAt: z.date().nullable(),
  willRenew: z.boolean(),
  /** 지금 기간이 끝난 뒤 이어서 시작하는 보상 일수 */
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

export type PremiumEndingNotice = 'tomorrow' | 'today';

export const PremiumAccessPolicy = {
  isGrantOnly(access: PremiumAccess) {
    return access.source === 'GRANT';
  },

  hasBankedDays(access: PremiumAccess) {
    return access.bankedDays > 0;
  },

  daysLeft(access: PremiumAccess, now: Date, timeZone: string) {
    return access.endsAt == null ? null : calculateDaysLeft(access.endsAt, now, timeZone);
  },

  // 자동 갱신되거나 이어서 받을 보상이 남았으면 전체 프리미엄은 아직 끝나지 않는다
  endingNotice(access: PremiumAccess, now: Date, timeZone: string): PremiumEndingNotice | null {
    const daysLeft = this.daysLeft(access, now, timeZone);
    if (
      access.endsAt == null ||
      daysLeft == null ||
      access.willRenew ||
      this.hasBankedDays(access)
    ) {
      return null;
    }

    if (
      hasPassed(access.endsAt, now) ||
      !isWithinNoticeDays(daysLeft, PREMIUM_ENDING_NOTICE_DAYS)
    ) {
      return null;
    }

    return daysLeft === 0 ? 'today' : 'tomorrow';
  },

  /** 보상 기간 중에 구독하면 남은 보상이 구독 뒤로 미뤄진다는 것을 함께 알린다 */
  purchaseSuccessMessage(access: PremiumAccess | undefined) {
    return access?.source === 'GRANT' ? 'purchaseSuccessWithReward' : 'purchaseSuccess';
  },

  /** 복원할 구매가 없어도 보상 기간은 그대로라는 것을 알린다 */
  restoreEmptyMessage(access: PremiumAccess | undefined) {
    return access?.source === 'GRANT' ? 'restoreEmptyWithReward' : 'restoreEmpty';
  },

  // 서버가 다시 계산한 값이 하나라도 바뀌면 한도·사용량 같은 프리미엄 의존 데이터도 달라진다
  hasChanged(previous: PremiumAccess, next: PremiumAccess) {
    return (
      previous.source !== next.source ||
      previous.endsAt?.getTime() !== next.endsAt?.getTime() ||
      previous.periodEndsAt?.getTime() !== next.periodEndsAt?.getTime() ||
      previous.willRenew !== next.willRenew ||
      previous.bankedDays !== next.bankedDays
    );
  },
};

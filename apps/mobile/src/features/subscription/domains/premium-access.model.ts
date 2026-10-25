import { PREMIUM_GRANT_ENDING_NOTICE_DAYS, PREMIUM_SOURCE, premiumSourceSchema } from '@aido/api';
import { formatDateKey } from '@src/shared/utils/date-format';
import { z } from 'zod';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const PremiumAccessSchema = z.object({
  source: premiumSourceSchema.nullable(),
  /** 쌓아 둔 보상까지 모두 이어 붙인 프리미엄의 끝(서버 premiumEndsAt) */
  endsAt: z.date().nullable(),
  /** 지금 출처(스토어 구독 또는 진행 중인 보상 기간)만 끝나는 시각(서버 premiumPeriodEndsAt) */
  periodEndsAt: z.date().nullable(),
  willRenew: z.boolean(),
  /** 지금 기간이 끝난 뒤 받은 순서대로 이어서 시작하는 보상 일수. 출처와 상관없이 있을 수 있다 */
  bankedDays: z.number().int().nonnegative(),
  /** 프리미엄이 아닐 때 최근 @aido/api PREMIUM_GRANT_ENDED_WINDOW_DAYS일 안에 끝난 마지막 보상 기간의 끝. 그 뒤로는 서버가 null로 보낸다 */
  grantEndedAt: z.date().nullable(),
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
    return access.source === PREMIUM_SOURCE.GRANT;
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
      !isWithinNoticeDays(daysLeft, PREMIUM_GRANT_ENDING_NOTICE_DAYS)
    ) {
      return null;
    }

    return daysLeft === 0 ? 'today' : 'tomorrow';
  },

  /** 보상 기간 중에 구독하면 남은 보상이 구독 뒤로 미뤄진다는 것을 함께 알린다 */
  purchaseSuccessMessage(access: PremiumAccess | undefined) {
    return access?.source === PREMIUM_SOURCE.GRANT
      ? 'purchaseSuccessWithReward'
      : 'purchaseSuccess';
  },

  /** 무료 페이월에서 "초대 보상 프리미엄이 끝났어요"를 붙일 날짜. 아직 프리미엄이면 null이다 */
  recentGrantEndedAt(access: PremiumAccess) {
    return access.source == null ? access.grantEndedAt : null;
  },

  /** 복원할 구매가 없어도 보상 기간은 그대로라는 것을 알린다 */
  restoreEmptyMessage(access: PremiumAccess | undefined) {
    return access?.source === PREMIUM_SOURCE.GRANT ? 'restoreEmptyWithReward' : 'restoreEmpty';
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

import {
  PREMIUM_GRANT_ENDING_NOTICE_DAYS,
  PREMIUM_RENEWAL_NOTICE_DAYS,
  PREMIUM_SOURCE,
  PREMIUM_TRIAL_ENDING_NOTICE_DAYS,
} from '@aido/api/vocabulary';
import { hasInstantPassed, type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { calculateCalendarDaysLeft } from '@src/shared/date/zoned';
import { planTypeSchema } from '@src/shared/domains/plan-type.model';
import { z } from 'zod';

export const premiumAccessSchema = z.object({
  source: z.enum(PREMIUM_SOURCE).nullable(),
  /** 쌓아 둔 보상까지 모두 이어 붙인 프리미엄의 끝(서버 premiumEndsAt) */
  endsAt: instantSchema.nullable(),
  /** 지금 출처(스토어 구독 또는 진행 중인 보상 기간)만 끝나는 시각(서버 premiumPeriodEndsAt) */
  periodEndsAt: instantSchema.nullable(),
  willRenew: z.boolean(),
  /** 스토어 구독이 무료 체험 기간인지(서버 premiumIsTrial). 체험 끝은 periodEndsAt이다 */
  isTrial: z.boolean(),
  /** 지금 기간이 끝난 뒤 받은 순서대로 이어서 시작하는 보상 일수. 출처와 상관없이 있을 수 있다 */
  bankedDays: z.int().nonnegative(),
  /** 프리미엄이 아닐 때 최근 PREMIUM_GRANT_ENDED_WINDOW_DAYS일 안에 끝난 마지막 보상 기간의 끝. 그 뒤로는 서버가 null로 보낸다 */
  grantEndedAt: instantSchema.nullable(),
  /** 지금 기간을 정하는 스토어 구독의 요금제(체험이면 체험 뒤 요금제). 모르면 null */
  planType: planTypeSchema.nullable(),
});
export type PremiumAccess = z.infer<typeof premiumAccessSchema>;

/** 영수증 출처. 관리자 > 초대 보상만 > 스토어 무료 체험 > 스토어 결제 순으로 고른다 */
type PremiumReceiptKind = 'admin' | 'reward' | 'trial' | 'paid';

/** 지금 기간 끝에 일어나는 결제. 자동 갱신 중인데 끝이 지났으면 스토어 갱신이 서버에 아직 반영되지 않았다(최대 유예 3시간) */
export type PremiumBilling =
  | { type: 'renews'; date: Instant }
  | { type: 'renewalPending' }
  | { type: 'ends'; date: Instant };

/** 쌓아 둔 보상. 자동 갱신 중이면 시작·끝이 갱신마다 밀려 둘 다 모른다(null) */
interface BankedReward {
  days: number;
  startsAt: Instant | null;
  endsAt: Instant | null;
}

/** 지금 기간이 끝난 뒤. 자동 갱신(쌓아 둔 보상은 그 뒤로 밀린다), 쌓아 둔 보상이 이어짐, 무료로 돌아감 */
type PremiumAfterPeriod =
  | { type: 'renews'; bankedDays: number }
  | { type: 'reward'; days: number; startsAt: Instant | null }
  | { type: 'free'; date: Instant };

function isWithinNoticeDays(daysLeft: number, noticeDays: number) {
  return daysLeft <= noticeDays;
}

/** 자동 갱신되거나 이어서 받을 보상이 있으면 전체 프리미엄은 아직 끝나지 않는다 */
function hasRenewal(access: PremiumAccess) {
  return access.willRenew || PremiumAccessPolicy.hasBankedDays(access);
}

function isSameInstant(a: Instant | null, b: Instant | null) {
  return a === b || (a != null && b != null && toEpochMs(a) === toEpochMs(b));
}

export const PremiumAccessPolicy = {
  /** 스토어 구독으로 프리미엄을 쓰는 중이라 구독을 다시 권하지 않는다 */
  isStoreSubscribed(access: PremiumAccess): boolean {
    return access.source === PREMIUM_SOURCE.STORE;
  },

  /** 서버는 STORE일 때만 체험이라고 보낸다. 출처가 바뀐 캐시가 섞여도 스토어 구독일 때만 체험으로 본다 */
  isTrial(access: PremiumAccess): boolean {
    return this.isStoreSubscribed(access) && access.isTrial;
  },

  isGrantOnly(access: PremiumAccess): boolean {
    return access.source === PREMIUM_SOURCE.GRANT;
  },

  hasBankedDays(access: PremiumAccess): boolean {
    return access.bankedDays > 0;
  },

  findDaysLeft(access: PremiumAccess, now: Instant, timezone: string): number | null {
    return access.endsAt == null ? null : calculateCalendarDaysLeft(access.endsAt, now, timezone);
  },

  /** 곧 끝나는데 이어질 길이 없는지. 이미 끝난 시각이면 곧 만료가 아니라 만료다 */
  isExpiringSoon(access: PremiumAccess, now: Instant, timezone: string): boolean {
    const daysLeft = this.findDaysLeft(access, now, timezone);
    if (access.endsAt == null || daysLeft == null) {
      return false;
    }

    return (
      !hasRenewal(access) &&
      !hasInstantPassed(access.endsAt, now) &&
      isWithinNoticeDays(daysLeft, PREMIUM_GRANT_ENDING_NOTICE_DAYS)
    );
  },

  /** 체험이 끝나는 날(=첫 결제일)까지 남은 달력 일수. 체험이 아니면 null이다 */
  findTrialDaysLeft(access: PremiumAccess, now: Instant, timezone: string): number | null {
    if (!this.isTrial(access) || access.periodEndsAt == null) {
      return null;
    }
    return calculateCalendarDaysLeft(access.periodEndsAt, now, timezone);
  },

  /** 자동 갱신과 상관없이 체험 끝을 서버 체험 알림과 같은 날수부터 앱 안에서도 알린다 */
  isTrialEndingSoon(access: PremiumAccess, now: Instant, timezone: string): boolean {
    const daysLeft = this.findTrialDaysLeft(access, now, timezone);
    if (access.periodEndsAt == null || daysLeft == null) {
      return false;
    }
    return (
      !hasInstantPassed(access.periodEndsAt, now) &&
      isWithinNoticeDays(daysLeft, PREMIUM_TRIAL_ENDING_NOTICE_DAYS)
    );
  },

  /** 자동 갱신되는 연간 구독이 서버 갱신 알림과 같은 날수 안에 결제될 때 남은 달력 일수. 그 밖에는 null이다 */
  findAnnualRenewalDaysLeft(access: PremiumAccess, now: Instant, timezone: string): number | null {
    if (
      !this.isStoreSubscribed(access) ||
      this.isTrial(access) ||
      !access.willRenew ||
      access.planType !== 'annual' ||
      access.periodEndsAt == null ||
      hasInstantPassed(access.periodEndsAt, now)
    ) {
      return null;
    }
    const daysLeft = calculateCalendarDaysLeft(access.periodEndsAt, now, timezone);
    return isWithinNoticeDays(daysLeft, PREMIUM_RENEWAL_NOTICE_DAYS) ? daysLeft : null;
  },

  /** 자동 갱신 중인데 지금 기간 끝이 지났으면 스토어 갱신 결과를 기다리는 중이다. 경계는 끝나는 시각 자체를 포함한다 */
  isRenewalPending(access: PremiumAccess, now: Instant): boolean {
    return (
      access.willRenew && access.periodEndsAt != null && hasInstantPassed(access.periodEndsAt, now)
    );
  },

  /** 무료 페이월에서 "초대 보상 프리미엄이 끝났어요"를 붙일 시각. 아직 프리미엄이면 null이다 */
  findRecentGrantEndedAt(access: PremiumAccess): Instant | null {
    return access.source == null ? access.grantEndedAt : null;
  },

  /** 끝나는 순간엔 서버 이벤트가 없어 앱이 다시 받아야 한다. 경계는 hasInstantPassed처럼 끝나는 시각 자체를 포함한다 */
  hasEndedSince(access: PremiumAccess, lastCheckedAt: Instant, now: Instant): boolean {
    return [access.periodEndsAt, access.endsAt].some(
      (endsAt) =>
        endsAt != null && !hasInstantPassed(endsAt, lastCheckedAt) && hasInstantPassed(endsAt, now),
    );
  },

  /** 초대 보상은 지금 구독(체험 포함)이 끝나는 순간부터 이어진다. 자동 갱신 중이면 끝이 정해지지 않아 시작일도 없다 */
  findBankedRewardStartsAt(access: PremiumAccess): Instant | null {
    if (!this.hasBankedDays(access) || access.willRenew || access.periodEndsAt == null) {
      return null;
    }
    return access.periodEndsAt;
  },

  /** 쌓아 둔 보상의 일수와 이어지는 기간. 자동 갱신 중이면 끝(전체 프리미엄의 끝)도 갱신마다 밀려 모른다 */
  findBankedReward(access: PremiumAccess): BankedReward | null {
    if (!this.hasBankedDays(access)) {
      return null;
    }
    return {
      days: access.bankedDays,
      startsAt: this.findBankedRewardStartsAt(access),
      endsAt: access.willRenew ? null : access.endsAt,
    };
  },

  getReceiptKind(access: PremiumAccess, { isAdmin }: { isAdmin: boolean }): PremiumReceiptKind {
    if (isAdmin) {
      return 'admin';
    }
    if (this.isGrantOnly(access)) {
      return 'reward';
    }
    return this.isTrial(access) ? 'trial' : 'paid';
  },

  /** 스토어 구독(체험 포함) 기간 끝의 결제. 기간을 모르면 null이다 */
  findBilling(access: PremiumAccess, now: Instant): PremiumBilling | null {
    if (access.periodEndsAt == null) {
      return null;
    }
    if (!access.willRenew) {
      return { type: 'ends', date: access.periodEndsAt };
    }
    return this.isRenewalPending(access, now)
      ? { type: 'renewalPending' }
      : { type: 'renews', date: access.periodEndsAt };
  },

  /** 지금 기간 뒤에 무엇이 이어지나. 자동 갱신이 먼저고, 아니면 쌓아 둔 보상, 둘 다 없으면 무료로 돌아가는 날이다 */
  findAfterPeriod(access: PremiumAccess): PremiumAfterPeriod | null {
    if (access.willRenew) {
      return { type: 'renews', bankedDays: access.bankedDays };
    }
    const banked = this.findBankedReward(access);
    if (banked != null) {
      return { type: 'reward', days: banked.days, startsAt: banked.startsAt };
    }
    return access.endsAt == null ? null : { type: 'free', date: access.endsAt };
  },

  /** 서버가 다시 계산한 값이 하나라도 바뀌면 한도·사용량 같은 프리미엄 의존 데이터도 달라진다 */
  hasChanged(previous: PremiumAccess, next: PremiumAccess): boolean {
    return (
      previous.source !== next.source ||
      !isSameInstant(previous.endsAt, next.endsAt) ||
      !isSameInstant(previous.periodEndsAt, next.periodEndsAt) ||
      previous.willRenew !== next.willRenew ||
      previous.isTrial !== next.isTrial ||
      previous.bankedDays !== next.bankedDays
    );
  },
};

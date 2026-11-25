import { PLAN_FEATURE_KEYS, PLAN_QUOTA_PERIODS } from '@aido/api/vocabulary';
import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { calculateCalendarDaysLeft } from '@src/shared/date/zoned';
import { z } from 'zod';

export const entitlementFeatureSchema = z.enum(PLAN_FEATURE_KEYS);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

const quotaPeriodSchema = z.enum(PLAN_QUOTA_PERIODS);
type QuotaPeriod = z.infer<typeof quotaPeriodSchema>;

export const perUseLimitSchema = z.object({
  maxSeconds: z.int().positive(),
  maxCharacters: z.int().positive(),
});

/** 서버가 계산한 기능 하나의 한도·사용량. 앱은 이 값을 그대로 쓰고 다시 계산하지 않는다 */
export const featureQuotaSchema = z.object({
  feature: entitlementFeatureSchema,
  allowed: z.boolean(),
  /** null은 정말 무제한(ADMIN, 켜진 flag)일 때만이다. 프리미엄의 넉넉한 한도는 숫자 + isFairUse다 */
  limit: z.int().nonnegative().nullable(),
  used: z.int().nonnegative().nullable(),
  remaining: z.int().nonnegative().nullable(),
  period: quotaPeriodSchema.nullable(),
  resetsAt: instantSchema.nullable(),
  isFairUse: z.boolean(),
  perUse: perUseLimitSchema.nullable(),
});
export type FeatureQuota = z.infer<typeof featureQuotaSchema>;

/** 기능을 지금 시작해도 되는지. 모르는 기능은 서버가 판단하도록 allow다 */
export type AccessDecision = 'allow' | 'limit-reached' | 'locked';

/** 남은 횟수를 알릴지와 무엇을 알릴지. 무제한·공정 사용 한도·횟수가 없는 기능은 untracked다 */
export type QuotaStatus =
  | { type: 'untracked' }
  | { type: 'remaining'; count: number; period: QuotaPeriod }
  | { type: 'used-up'; period: QuotaPeriod };

export type QuotaResetNotice =
  | { type: 'today' }
  | { type: 'tomorrow' }
  | { type: 'date'; date: Instant };

export const FeatureQuotaPolicy = {
  /** 초기화 시각이 지난 값은 오래된 스냅샷이다. 그 사이 횟수가 다시 찼다 */
  hasResetPassed(quota: FeatureQuota, now: Instant): boolean {
    return quota.resetsAt != null && hasInstantPassed(quota.resetsAt, now);
  },

  /** 아직 오지 않은 초기화 순간. 이미 지난 것(오래된 스냅샷·서버 시계 지연)은 null이다 */
  findUpcomingResetAt(quota: FeatureQuota, now: Instant): Instant | null {
    return quota.resetsAt == null || this.hasResetPassed(quota, now) ? null : quota.resetsAt;
  },

  /** 초기화 시각이 지난 스냅샷의 남은 0은 오래된 값이다. 앱이 막지 않고 서버에 맡긴다 */
  getAccessDecision(quota: FeatureQuota, now: Instant): AccessDecision {
    if (!quota.allowed) {
      return 'locked';
    }
    if (quota.remaining !== 0) {
      return 'allow';
    }
    return this.hasResetPassed(quota, now) ? 'allow' : 'limit-reached';
  },

  /** 초기화 시각이 지난 스냅샷은 남은 횟수가 몇이든 믿지 않는다. 그 사이 횟수가 다시 찼다 */
  getStatus(quota: FeatureQuota, now: Instant): QuotaStatus {
    if (
      quota.isFairUse ||
      quota.limit == null ||
      quota.remaining == null ||
      quota.period == null ||
      this.hasResetPassed(quota, now)
    ) {
      return { type: 'untracked' };
    }
    return quota.remaining === 0
      ? { type: 'used-up', period: quota.period }
      : { type: 'remaining', count: quota.remaining, period: quota.period };
  },

  /** 기기 시간대 달력으로 오늘·내일·날짜를 고르고, 이미 지난 초기화 시각(오래된 스냅샷)은 믿지 않는다 */
  findResetNotice(
    quota: FeatureQuota,
    { now, timezone }: { now: Instant; timezone: string },
  ): QuotaResetNotice | null {
    const resetsAt = this.findUpcomingResetAt(quota, now);
    if (quota.limit == null || resetsAt == null) {
      return null;
    }

    const daysLeft = calculateCalendarDaysLeft(resetsAt, now, timezone);
    if (daysLeft === 0) {
      return { type: 'today' };
    }
    return daysLeft === 1 ? { type: 'tomorrow' } : { type: 'date', date: resetsAt };
  },
};

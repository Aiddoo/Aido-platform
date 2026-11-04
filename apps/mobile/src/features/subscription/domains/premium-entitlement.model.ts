import {
  PREMIUM_FEATURE_KEYS,
  PREMIUM_FEATURES,
  premiumFeatureEntitlementSchema,
  type PremiumLimitFeatureKey,
} from '@aido/api';
import { z } from 'zod';

import { calculateDaysLeft, hasPassed } from './premium-access.model';

export const PremiumFeatureEntitlementSchema = premiumFeatureEntitlementSchema.extend({
  resetsAt: z.date().optional(),
});
export type PremiumFeatureEntitlement = z.infer<typeof PremiumFeatureEntitlementSchema>;

export const PremiumEntitlementsSchema = z.record(
  z.enum(PREMIUM_FEATURE_KEYS),
  PremiumFeatureEntitlementSchema,
);
export type PremiumEntitlements = z.infer<typeof PremiumEntitlementsSchema>;

/** 한도를 정할 때 필요한 사용자 값 */
export interface PremiumEntitlementSubject {
  entitlements: PremiumEntitlements;
  isPremium: boolean;
}

/** 다 쓴 횟수가 다시 채워지는 때 */
export type QuotaResetNotice =
  | { type: 'today' }
  | { type: 'tomorrow' }
  | { type: 'date'; date: Date };

export const PremiumEntitlementPolicy = {
  /** 지금 한도. null은 무제한이다 */
  limit(
    subject: Pick<PremiumEntitlementSubject, 'entitlements'>,
    feature: PremiumLimitFeatureKey,
  ): number | null {
    return subject.entitlements[feature].limit;
  },

  /** 무료로 쓸 수 있는 한도(혜택 안내용). 무료 사용자는 초대로 늘어난 자리까지 반영한 서버 값을 쓴다 */
  freeLimit(subject: PremiumEntitlementSubject, feature: PremiumLimitFeatureKey): number {
    const { limit } = subject.entitlements[feature];
    return !subject.isPremium && limit != null ? limit : PREMIUM_FEATURES[feature].free;
  },

  /**
   * 한도가 있는 횟수 기능이 언제 다시 채워지는지. 기기 시간대의 달력으로 오늘·내일·날짜를 고른다.
   * 이미 지난 초기화 시각(오래된 내 정보)은 믿지 않는다
   */
  resetNotice(
    quota: Pick<PremiumFeatureEntitlement, 'limit' | 'resetsAt'>,
    now: Date,
    timeZone: string,
  ): QuotaResetNotice | null {
    const { limit, resetsAt } = quota;
    if (limit == null || resetsAt == null || hasPassed(resetsAt, now)) {
      return null;
    }

    const daysLeft = calculateDaysLeft(resetsAt, now, timeZone);
    if (daysLeft === 0) {
      return { type: 'today' };
    }
    return daysLeft === 1 ? { type: 'tomorrow' } : { type: 'date', date: resetsAt };
  },
};

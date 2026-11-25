import {
  ACCESS_TIERS,
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  PLAN_QUOTA_PERIODS,
  type Plan,
  type PlanHorizonFeatureKey,
  type PlanLimitFeatureKey,
} from '@aido/api/vocabulary';
import { DAY_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import {
  diffMs,
  hasInstantPassed,
  type Instant,
  instantSchema,
  toEpochMs,
} from '@src/shared/date/instant';
import { calculateCalendarDaysLeft } from '@src/shared/date/zoned';
import { clamp, minBy } from 'es-toolkit';
import { z } from 'zod';

const entitlementFeatureSchema = z.enum(PLAN_FEATURE_KEYS);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

const accessTierSchema = z.enum(ACCESS_TIERS);
export type AccessTier = z.infer<typeof accessTierSchema>;

const quotaPeriodSchema = z.enum(PLAN_QUOTA_PERIODS);
type QuotaPeriod = z.infer<typeof quotaPeriodSchema>;

/** 서버가 계산한 기능 하나의 한도·사용량. 앱은 이 값을 그대로 쓰고 다시 계산하지 않는다 */
const perUseLimitSchema = z.object({
  maxSeconds: z.int().positive(),
  maxCharacters: z.int().positive(),
});

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

/** 서버가 집행하는 요금제 하나의 기능 값(받은 자리 없이). limit·perUse의 null은 무제한이다 */
const planFeatureLimitSchema = z.object({
  allowed: z.boolean(),
  limit: z.int().nonnegative().nullable(),
  isFairUse: z.boolean(),
  perUse: perUseLimitSchema.nullable(),
});

const planComparisonSchema = z.object({
  free: planFeatureLimitSchema,
  premium: planFeatureLimitSchema,
});

export const entitlementSnapshotSchema = z.object({
  /** 유효한 스토어 구독·보상 기간이 있는지. ADMIN은 반영하지 않는다 */
  isPremium: z.boolean(),
  tier: accessTierSchema,
  features: z.partialRecord(entitlementFeatureSchema, featureQuotaSchema),
  /** 결제 화면의 무료·프리미엄 비교. 운영 중 바뀐 요금제 숫자도 서버 값 그대로다 */
  plans: z.record(entitlementFeatureSchema, planComparisonSchema),
});
export type EntitlementSnapshot = z.infer<typeof entitlementSnapshotSchema>;

/** 기능을 지금 시작해도 되는지. 모르는 기능은 서버가 판단하도록 allow다 */
type AccessDecision = 'allow' | 'limit-reached' | 'locked';

/** 남은 횟수를 알릴지와 무엇을 알릴지. 무제한·공정 사용 한도·횟수가 없는 기능은 untracked다 */
type QuotaStatus =
  | { type: 'untracked' }
  | { type: 'remaining'; count: number; period: QuotaPeriod }
  | { type: 'used-up'; period: QuotaPeriod };

type QuotaResetNotice = { type: 'today' } | { type: 'tomorrow' } | { type: 'date'; date: Instant };

function findFeatureQuota(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): FeatureQuota | null {
  return snapshot.features[feature] ?? null;
}

/** 아직 오지 않은 초기화 중 가장 이른 순간. 이미 지난 것(오래된 스냅샷·서버 시계 지연)은 건너뛴다 */
function findNextResetAt(snapshot: EntitlementSnapshot, now: Instant): Instant | null {
  const upcomingInstants = Object.values(snapshot.features).flatMap((quota) =>
    quota?.resetsAt == null || hasInstantPassed(quota.resetsAt, now) ? [] : [quota.resetsAt],
  );
  return minBy(upcomingInstants, toEpochMs) ?? null;
}

export interface LimitedFeature {
  feature: EntitlementFeature;
  /** 서버가 오류와 함께 준 현재 한도. 상세를 싣지 않는 코드는 null이다 */
  featureQuota: FeatureQuota | null;
}

/** 서버가 막은 기능의 오류가 한도 소진인지 등급 잠금인지. 서버가 한도를 함께 줬으면 그 값을 따른다 */
export function getBlockedDecision(limited: LimitedFeature): Exclude<AccessDecision, 'allow'> {
  if (limited.featureQuota != null) {
    return limited.featureQuota.allowed ? 'limit-reached' : 'locked';
  }
  return PLAN_CATALOG[limited.feature].kind === 'flag' ? 'locked' : 'limit-reached';
}

export const EntitlementPolicy = {
  /** 프리미엄 기능을 모두 쓸 수 있는지. 관리자는 구독이 없어도 모든 기능을 쓴다 */
  hasFullAccess(snapshot: EntitlementSnapshot): boolean {
    return snapshot.tier !== 'FREE';
  },

  /** 서버가 이 등급에 연 기능인지. 모르는 기능은 서버가 판단하도록 막지 않는다 */
  canUseFeature(snapshot: EntitlementSnapshot, feature: EntitlementFeature): boolean {
    return findFeatureQuota(snapshot, feature)?.allowed !== false;
  },

  /** 초기화 시각이 지난 스냅샷의 남은 0은 오래된 값이다. 앱이 막지 않고 서버에 맡긴다 */
  getAccessDecision(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    now: Instant,
  ): AccessDecision {
    const quota = findFeatureQuota(snapshot, feature);
    if (quota == null) {
      return 'allow';
    }
    if (!quota.allowed) {
      return 'locked';
    }
    if (quota.remaining !== 0) {
      return 'allow';
    }
    return quota.resetsAt != null && hasInstantPassed(quota.resetsAt, now)
      ? 'allow'
      : 'limit-reached';
  },

  /** null은 무제한이거나 알 수 없다 */
  findLimit(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return findFeatureQuota(snapshot, feature)?.limit ?? null;
  },

  /** 서버가 센 사용량. 세지 않는 기능·무제한은 null이다 */
  findUsedCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return findFeatureQuota(snapshot, feature)?.used ?? null;
  },

  /** 세지 않는 기능·무제한은 null이다 */
  findRemainingCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return findFeatureQuota(snapshot, feature)?.remaining ?? null;
  },

  /** 초 단위. 길이 제한이 없으면 null이다 */
  findMaxSeconds(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return findFeatureQuota(snapshot, feature)?.perUse?.maxSeconds ?? null;
  },

  /** 초기화 시각이 지난 스냅샷은 남은 횟수가 몇이든 믿지 않는다. 그 사이 횟수가 다시 찼다 */
  getQuotaStatus(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    now: Instant,
  ): QuotaStatus {
    const quota = findFeatureQuota(snapshot, feature);
    if (
      quota == null ||
      quota.isFairUse ||
      quota.limit == null ||
      quota.remaining == null ||
      quota.period == null
    ) {
      return { type: 'untracked' };
    }
    if (quota.resetsAt != null && hasInstantPassed(quota.resetsAt, now)) {
      return { type: 'untracked' };
    }
    return quota.remaining === 0
      ? { type: 'used-up', period: quota.period }
      : { type: 'remaining', count: quota.remaining, period: quota.period };
  },

  /** 기기 시간대 달력으로 오늘·내일·날짜를 고르고, 이미 지난 초기화 시각(오래된 스냅샷)은 믿지 않는다 */
  findResetNotice(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    { now, timezone }: { now: Instant; timezone: string },
  ): QuotaResetNotice | null {
    const quota = findFeatureQuota(snapshot, feature);
    if (quota?.limit == null || quota.resetsAt == null || hasInstantPassed(quota.resetsAt, now)) {
      return null;
    }

    const daysLeft = calculateCalendarDaysLeft(quota.resetsAt, now, timezone);
    if (daysLeft === 0) {
      return { type: 'today' };
    }
    return daysLeft === 1 ? { type: 'tomorrow' } : { type: 'date', date: quota.resetsAt };
  },

  /**
   * 남은 횟수는 초기화 순간(resetsAt)에 바뀌므로 그 순간에 다시 받는다. 한 달 뒤 초기화는 타이머 상한을 넘지 않게
   * 하루마다 다시 재고, 올 초기화가 없으면 시각으로 묻지 않는다(false)
   */
  getRefetchIntervalMs(snapshot: EntitlementSnapshot, now: Instant): number | false {
    const nextResetAt = findNextResetAt(snapshot, now);
    if (nextResetAt == null) {
      return false;
    }
    return clamp(diffMs(nextResetAt, now), MINUTE_MS, DAY_MS);
  },

  /** 요금제의 집행 한도. null은 무제한이다 */
  findPlanLimit(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    plan: Plan,
  ): number | null {
    return snapshot.plans[feature][plan].limit;
  },

  /** 요금제의 한 번 길이 상한(초). null은 길이 제한이 없다 */
  findPlanMaxSeconds(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    plan: Plan,
  ): number | null {
    return snapshot.plans[feature][plan].perUse?.maxSeconds ?? null;
  },

  /** 요금제에서 쓸 수 있는 기능인지 */
  canUseOnPlan(snapshot: EntitlementSnapshot, feature: EntitlementFeature, plan: Plan): boolean {
    return snapshot.plans[feature][plan].allowed;
  },

  /** 무료 사용자는 초대로 늘어난 자리까지 반영한 내 한도를, 프리미엄·관리자는 서버의 무료 요금제 한도를 쓴다 */
  findFreeLimit(
    snapshot: EntitlementSnapshot,
    feature: PlanLimitFeatureKey | PlanHorizonFeatureKey,
  ): number | null {
    const limit = this.findLimit(snapshot, feature);
    return snapshot.tier === 'FREE' && limit != null
      ? limit
      : this.findPlanLimit(snapshot, feature, 'free');
  },

  withFeatureQuota(snapshot: EntitlementSnapshot, quota: FeatureQuota): EntitlementSnapshot {
    return { ...snapshot, features: { ...snapshot.features, [quota.feature]: quota } };
  },

  /** 프리미엄·관리자가 공정 사용 한도에 닿으면 구독을 권하지 않는다. 스냅샷을 모르면 권한다 */
  shouldOfferPremium(snapshot: EntitlementSnapshot | undefined): boolean {
    return snapshot == null || !this.hasFullAccess(snapshot);
  },
};

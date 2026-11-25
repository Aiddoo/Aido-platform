import {
  ACCESS_TIERS,
  type Plan,
  type PlanHorizonFeatureKey,
  type PlanLimitFeatureKey,
} from '@aido/api/vocabulary';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { minBy } from 'es-toolkit';
import { z } from 'zod';

import {
  type AccessDecision,
  type EntitlementFeature,
  entitlementFeatureSchema,
  type FeatureQuota,
  featureQuotaSchema,
  FeatureQuotaPolicy,
  perUseLimitSchema,
  type QuotaResetNotice,
  type QuotaStatus,
} from './feature-quota.model';

const accessTierSchema = z.enum(ACCESS_TIERS);
export type AccessTier = z.infer<typeof accessTierSchema>;

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

export const EntitlementPolicy = {
  /** 스냅샷에 없는 기능은 null이다. 서버가 판단하도록 앱은 막지 않는다 */
  findFeatureQuota(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
  ): FeatureQuota | null {
    return snapshot.features[feature] ?? null;
  },

  /** 프리미엄 기능을 모두 쓸 수 있는지. 관리자는 구독이 없어도 모든 기능을 쓴다 */
  hasFullAccess(snapshot: EntitlementSnapshot): boolean {
    return snapshot.tier !== 'FREE';
  },

  /** 서버가 이 등급에 연 기능인지. 모르는 기능은 서버가 판단하도록 막지 않는다 */
  canUseFeature(snapshot: EntitlementSnapshot, feature: EntitlementFeature): boolean {
    return this.findFeatureQuota(snapshot, feature)?.allowed !== false;
  },

  getAccessDecision(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    now: Instant,
  ): AccessDecision {
    const quota = this.findFeatureQuota(snapshot, feature);
    return quota == null ? 'allow' : FeatureQuotaPolicy.getAccessDecision(quota, now);
  },

  /** null은 무제한이거나 알 수 없다 */
  findLimit(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return this.findFeatureQuota(snapshot, feature)?.limit ?? null;
  },

  /** 서버가 센 사용량. 세지 않는 기능·무제한은 null이다 */
  findUsedCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return this.findFeatureQuota(snapshot, feature)?.used ?? null;
  },

  /** 세지 않는 기능·무제한은 null이다 */
  findRemainingCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return this.findFeatureQuota(snapshot, feature)?.remaining ?? null;
  },

  /** 초 단위. 길이 제한이 없으면 null이다 */
  findMaxSeconds(snapshot: EntitlementSnapshot, feature: EntitlementFeature): number | null {
    return this.findFeatureQuota(snapshot, feature)?.perUse?.maxSeconds ?? null;
  },

  getQuotaStatus(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    now: Instant,
  ): QuotaStatus {
    const quota = this.findFeatureQuota(snapshot, feature);
    return quota == null ? { type: 'untracked' } : FeatureQuotaPolicy.getStatus(quota, now);
  },

  findResetNotice(
    snapshot: EntitlementSnapshot,
    feature: EntitlementFeature,
    clock: { now: Instant; timezone: string },
  ): QuotaResetNotice | null {
    const quota = this.findFeatureQuota(snapshot, feature);
    return quota == null ? null : FeatureQuotaPolicy.findResetNotice(quota, clock);
  },

  /** 남은 횟수가 바뀌는 다음 순간. 아직 오지 않은 초기화 중 가장 이른 것이고 없으면 null이다 */
  findNextResetAt(snapshot: EntitlementSnapshot, now: Instant): Instant | null {
    const upcomingInstants = Object.values(snapshot.features).flatMap((quota) => {
      const resetsAt = quota == null ? null : FeatureQuotaPolicy.findUpcomingResetAt(quota, now);
      return resetsAt == null ? [] : [resetsAt];
    });
    return minBy(upcomingInstants, toEpochMs) ?? null;
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

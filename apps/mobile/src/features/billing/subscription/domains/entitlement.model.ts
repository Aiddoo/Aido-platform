import {
  ACCESS_TIERS,
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  PLAN_QUOTA_PERIODS,
  type PlanLimitFeatureKey,
} from '@aido/api/vocabulary';
import {
  calculateCalendarDaysLeft,
  hasInstantPassed,
  type Instant,
  instantSchema,
} from '@src/shared/date/instant';
import { z } from 'zod';

import type { LimitedFeature } from './entitlement.error';

const entitlementFeatureSchema = z.enum(PLAN_FEATURE_KEYS);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

const accessTierSchema = z.enum(ACCESS_TIERS);
export type AccessTier = z.infer<typeof accessTierSchema>;

const quotaPeriodSchema = z.enum(PLAN_QUOTA_PERIODS);
export type QuotaPeriod = z.infer<typeof quotaPeriodSchema>;

export const featureQuotaSchema = z.object({
  feature: entitlementFeatureSchema,
  allowed: z.boolean(),
  limit: z.int().nonnegative().nullable(),
  used: z.int().nonnegative().nullable(),
  remaining: z.int().nonnegative().nullable(),
  period: quotaPeriodSchema.nullable(),
  resetsAt: instantSchema.nullable(),
  isFairUse: z.boolean(),
  perUse: z
    .object({ maxSeconds: z.int().positive(), maxCharacters: z.int().positive() })
    .nullable(),
});
export type FeatureQuota = z.infer<typeof featureQuotaSchema>;

export const entitlementSnapshotSchema = z.object({
  isPremium: z.boolean(),
  tier: accessTierSchema,
  features: z.partialRecord(entitlementFeatureSchema, featureQuotaSchema),
});
export type EntitlementSnapshot = z.infer<typeof entitlementSnapshotSchema>;

type AccessDecision = 'allow' | 'limit-reached' | 'locked';

type QuotaStatus =
  | { type: 'untracked' }
  | { type: 'remaining'; count: number; period: QuotaPeriod }
  | { type: 'used-up'; period: QuotaPeriod };

type QuotaResetNotice = { type: 'today' } | { type: 'tomorrow' } | { type: 'date'; date: Instant };

function hasFullAccess(snapshot: EntitlementSnapshot): boolean {
  return snapshot.tier !== 'FREE';
}

function findFeatureQuota(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): FeatureQuota | null {
  return snapshot.features[feature] ?? null;
}

function canUseFeature(snapshot: EntitlementSnapshot, feature: EntitlementFeature): boolean {
  return findFeatureQuota(snapshot, feature)?.allowed !== false;
}

function getAccessDecision(
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
}

function getLimit(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.limit ?? null;
}

function getRemainingCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.remaining ?? null;
}

function getMaxSeconds(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.perUse?.maxSeconds ?? null;
}

function getQuotaStatus(
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
  if (quota.remaining === 0 && quota.resetsAt != null && hasInstantPassed(quota.resetsAt, now)) {
    return { type: 'untracked' };
  }
  return quota.remaining === 0
    ? { type: 'used-up', period: quota.period }
    : { type: 'remaining', count: quota.remaining, period: quota.period };
}

function getResetNotice(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
  { now, timeZone }: { now: Instant; timeZone: string },
): QuotaResetNotice | null {
  const quota = findFeatureQuota(snapshot, feature);
  if (quota?.limit == null || quota.resetsAt == null || hasInstantPassed(quota.resetsAt, now)) {
    return null;
  }

  const daysLeft = calculateCalendarDaysLeft(quota.resetsAt, now, timeZone);
  if (daysLeft === 0) {
    return { type: 'today' };
  }
  return daysLeft === 1 ? { type: 'tomorrow' } : { type: 'date', date: quota.resetsAt };
}

function getFreeLimit(snapshot: EntitlementSnapshot, feature: PlanLimitFeatureKey): number {
  const limit = getLimit(snapshot, feature);
  return snapshot.tier === 'FREE' && limit != null ? limit : PLAN_CATALOG[feature].free;
}

function withFeatureQuota(snapshot: EntitlementSnapshot, quota: FeatureQuota): EntitlementSnapshot {
  return { ...snapshot, features: { ...snapshot.features, [quota.feature]: quota } };
}

function getBlockedDecision(
  limited: Pick<LimitedFeature, 'feature'> & {
    featureQuota: Pick<FeatureQuota, 'allowed'> | null;
  },
): Exclude<AccessDecision, 'allow'> {
  if (limited.featureQuota != null) {
    return limited.featureQuota.allowed ? 'limit-reached' : 'locked';
  }
  return PLAN_CATALOG[limited.feature].kind === 'flag' ? 'locked' : 'limit-reached';
}

function shouldOfferPremium(snapshot: EntitlementSnapshot | undefined) {
  return snapshot == null || !hasFullAccess(snapshot);
}

export const EntitlementPolicy = {
  hasFullAccess,
  canUseFeature,
  getAccessDecision,
  getLimit,
  getRemainingCount,
  getMaxSeconds,
  getQuotaStatus,
  getResetNotice,
  withFeatureQuota,
  getBlockedDecision,
  shouldOfferPremium,
  getFreeLimit,
} as const;

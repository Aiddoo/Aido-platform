import {
  ACCESS_TIERS,
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  PLAN_QUOTA_PERIODS,
  type PlanLimitFeatureKey,
} from '@aido/api/vocabulary';
import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { calculateCalendarDaysLeft } from '@src/shared/date/zoned';
import { z } from 'zod';

const entitlementFeatureSchema = z.enum(PLAN_FEATURE_KEYS);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

const accessTierSchema = z.enum(ACCESS_TIERS);
export type AccessTier = z.infer<typeof accessTierSchema>;

const quotaPeriodSchema = z.enum(PLAN_QUOTA_PERIODS);
type QuotaPeriod = z.infer<typeof quotaPeriodSchema>;

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
  perUse: z
    .object({ maxSeconds: z.int().positive(), maxCharacters: z.int().positive() })
    .nullable(),
});
export type FeatureQuota = z.infer<typeof featureQuotaSchema>;

export const entitlementSnapshotSchema = z.object({
  /** 유효한 스토어 구독·보상 기간이 있는지. ADMIN은 반영하지 않는다 */
  isPremium: z.boolean(),
  tier: accessTierSchema,
  features: z.partialRecord(entitlementFeatureSchema, featureQuotaSchema),
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

/** 프리미엄 기능을 모두 쓸 수 있는지. 관리자는 구독이 없어도 모든 기능을 쓴다 */
function hasFullAccess(snapshot: EntitlementSnapshot): boolean {
  return snapshot.tier !== 'FREE';
}

function findFeatureQuota(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
): FeatureQuota | null {
  return snapshot.features[feature] ?? null;
}

/** 서버가 이 등급에 연 기능인지. 모르는 기능은 서버가 판단하도록 막지 않는다 */
function canUseFeature(snapshot: EntitlementSnapshot, feature: EntitlementFeature): boolean {
  return findFeatureQuota(snapshot, feature)?.allowed !== false;
}

/** 초기화 시각이 지난 스냅샷의 남은 0은 오래된 값이다. 앱이 막지 않고 서버에 맡긴다 */
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

/** null은 무제한이거나 알 수 없다 */
function getLimit(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.limit ?? null;
}

/** 서버가 센 사용량. 세지 않는 기능·무제한은 null이다 */
function getUsedCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.used ?? null;
}

/** 세지 않는 기능·무제한은 null이다 */
function getRemainingCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.remaining ?? null;
}

/** 초 단위. 길이 제한이 없으면 null이다 */
function getMaxSeconds(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.perUse?.maxSeconds ?? null;
}

/** 다 쓴 상태라도 초기화 시각이 이미 지난 스냅샷은 믿지 않는다(실제로는 다시 쓸 수 있다) */
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

/** 기기 시간대 달력으로 오늘·내일·날짜를 고르고, 이미 지난 초기화 시각(오래된 스냅샷)은 믿지 않는다 */
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

/** 무료 사용자는 초대로 늘어난 자리까지 반영한 서버 값을, 프리미엄·관리자는 카탈로그 무료 한도를 쓴다 */
function getFreeLimit(snapshot: EntitlementSnapshot, feature: PlanLimitFeatureKey): number {
  const limit = getLimit(snapshot, feature);
  return snapshot.tier === 'FREE' && limit != null ? limit : PLAN_CATALOG[feature].free;
}

function withFeatureQuota(snapshot: EntitlementSnapshot, quota: FeatureQuota): EntitlementSnapshot {
  return { ...snapshot, features: { ...snapshot.features, [quota.feature]: quota } };
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

/** 프리미엄·관리자가 공정 사용 한도에 닿으면 구독을 권하지 않는다. 스냅샷을 모르면 권한다 */
function shouldOfferPremium(snapshot: EntitlementSnapshot | undefined) {
  return snapshot == null || !hasFullAccess(snapshot);
}

export const EntitlementPolicy = {
  hasFullAccess,
  canUseFeature,
  getAccessDecision,
  getLimit,
  getUsedCount,
  getRemainingCount,
  getMaxSeconds,
  getQuotaStatus,
  getResetNotice,
  withFeatureQuota,
  shouldOfferPremium,
  getFreeLimit,
} as const;

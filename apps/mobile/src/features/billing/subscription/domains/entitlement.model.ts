import { PLAN_CATALOG, type PlanLimitFeatureKey } from '@aido/api/vocabulary';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import type { Instant } from '@src/shared/date/instant';

import type {
  EntitlementFeature,
  EntitlementSnapshot,
  FeatureQuota,
  QuotaPeriod,
} from '../schemas/entitlement.schema';

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
  return quota.resetsAt != null && PremiumAccessPolicy.hasPassed(quota.resetsAt, now)
    ? 'allow'
    : 'limit-reached';
}

/** 지금 한도. null은 무제한이거나 알 수 없다 */
function getLimit(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.limit ?? null;
}

/** 이번 기간에 남은 횟수. 세지 않는 기능·무제한은 null이다 */
function getRemainingCount(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  return findFeatureQuota(snapshot, feature)?.remaining ?? null;
}

/** 한 번 쓸 수 있는 최대 길이(초). 길이 제한이 없으면 null이다 */
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
  if (
    quota.remaining === 0 &&
    quota.resetsAt != null &&
    PremiumAccessPolicy.hasPassed(quota.resetsAt, now)
  ) {
    return { type: 'untracked' };
  }
  return quota.remaining === 0
    ? { type: 'used-up', period: quota.period }
    : { type: 'remaining', count: quota.remaining, period: quota.period };
}

/**
 * 횟수 기능이 언제 다시 채워지는지. 기기 시간대의 달력으로 오늘·내일·날짜를 고른다.
 * 이미 지난 초기화 시각(오래된 스냅샷)은 믿지 않는다
 */
function getResetNotice(
  snapshot: EntitlementSnapshot,
  feature: EntitlementFeature,
  { now, timeZone }: { now: Instant; timeZone: string },
): QuotaResetNotice | null {
  const quota = findFeatureQuota(snapshot, feature);
  if (
    quota?.limit == null ||
    quota.resetsAt == null ||
    PremiumAccessPolicy.hasPassed(quota.resetsAt, now)
  ) {
    return null;
  }

  const daysLeft = PremiumAccessPolicy.calculateDaysLeft(quota.resetsAt, now, timeZone);
  if (daysLeft === 0) {
    return { type: 'today' };
  }
  return daysLeft === 1 ? { type: 'tomorrow' } : { type: 'date', date: quota.resetsAt };
}

/**
 * 무료로 쓸 수 있는 한도(혜택 안내용). 무료 사용자는 초대로 늘어난 자리까지 반영한 서버 값을,
 * 프리미엄·관리자는 카탈로그의 무료 한도를 쓴다
 */
function getFreeLimit(snapshot: EntitlementSnapshot, feature: PlanLimitFeatureKey): number {
  const limit = getLimit(snapshot, feature);
  return snapshot.tier === 'FREE' && limit != null ? limit : PLAN_CATALOG[feature].free;
}

function withFeatureQuota(snapshot: EntitlementSnapshot, quota: FeatureQuota): EntitlementSnapshot {
  return { ...snapshot, features: { ...snapshot.features, [quota.feature]: quota } };
}

/** 서버가 막은 기능의 오류가 한도 소진인지 등급 잠금인지. 서버가 한도를 함께 줬으면 그 값을 따른다 */
function getBlockedDecision(
  feature: EntitlementFeature,
  quota: Pick<FeatureQuota, 'allowed'> | null,
): Exclude<AccessDecision, 'allow'> {
  if (quota != null) {
    return quota.allowed ? 'limit-reached' : 'locked';
  }
  return PLAN_CATALOG[feature].kind === 'flag' ? 'locked' : 'limit-reached';
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
  getRemainingCount,
  getMaxSeconds,
  getQuotaStatus,
  getResetNotice,
  withFeatureQuota,
  getBlockedDecision,
  shouldOfferPremium,
  getFreeLimit,
} as const;

import {
  GRANTABLE_FEATURE_KEYS,
  PLAN_CATALOG,
  USER_ROLE,
  type AccessTier,
  type GrantableFeature,
  type Plan,
  type PlanFeature,
  type PlanFlagFeatureKey,
  type PlanLimitFeatureKey,
  type PlanQuotaFeatureKey,
  type PlanQuotaPeriod,
  type PlanResourceFeatureKey,
  type UserRole,
} from "@aido/api/vocabulary";
import { mapValues } from "es-toolkit";
import { match } from "ts-pattern";

import type { FeatureGrants } from "./access.constants.js";
import { hasPaidAccess, type PaidAccessState } from "./paid-access.domain-service.js";

/** 권한 판단에 쓰는 사용자 상태. 역할(USER·ADMIN)의 출처는 identity다. */
export interface AccessState extends PaidAccessState {
  readonly role: UserRole;
}

/**
 * 판단 시각의 권한 주체. tier는 누구인가(출시 앱 표시), plan은 어느 요금제의 기능 값을 받는가다.
 * 기능·한도·공정 사용 상한·휴면 제외는 모두 plan으로만 정한다.
 */
export interface AccessSubject {
  readonly tier: AccessTier;
  readonly plan: Plan;
  /** 유효한 스토어 구독이나 보상 기간이 있는지(결제 사실). ADMIN role은 반영하지 않는다. */
  readonly isPremium: boolean;
}

/** 요금제가 연 기능 하나 */
export interface FeatureEntitlement {
  readonly allowed: boolean;
  /** quota·resource의 표시 한도(받은 자리 포함). null은 무제한이고 flag는 항상 null이다. */
  readonly limit: number | null;
}

/** 서버가 집행하는 quota 한도 */
export interface QuotaLimit {
  /** 이 한도에 닿으면 막는다. null은 공정 사용 상한도 없는 정말 무제한이다. */
  readonly limit: number | null;
  /** 무제한으로 보이는 요금제에 걸린 공정 사용 상한인지 */
  readonly isFairUse: boolean;
}

/** 서버가 판단하는 flag. 앱만 막는 기능(clientOnly)은 뺀다. */
export type ServerFlagFeature = Exclude<PlanFlagFeatureKey, "APP_ICON">;

export interface PerUseLimit {
  readonly maxSeconds: number;
  readonly maxCharacters: number;
}

/** 기능 하나의 현재 사용량. resource(친구·카테고리)는 다시 채워지지 않아 resetsAt이 null이다. */
export interface FeatureUsageReading {
  readonly used: number;
  readonly resetsAt: Temporal.Instant | null;
}

/** 한 기간의 사용량. 소유 Context(계량기·응원·찌르기)가 센다. */
export interface QuotaUsageReading extends FeatureUsageReading {
  readonly resetsAt: Temporal.Instant;
}

/** 서버가 계산한 기능 하나의 한도와 사용량. 공개 계약 featureQuota의 원본이다. */
export interface FeatureQuotaState {
  readonly feature: PlanFeature;
  readonly allowed: boolean;
  /** 집행 한도. null은 정말 무제한(flag, 상한 없는 quota·resource)이다. */
  readonly limit: number | null;
  /** null은 서버가 이 기능 사용량을 세지 않는다는 뜻이다(flag, 개수를 받지 않았거나 무제한인 resource). */
  readonly used: number | null;
  readonly remaining: number | null;
  readonly period: PlanQuotaPeriod | null;
  readonly resetsAt: Temporal.Instant | null;
  readonly isFairUse: boolean;
  readonly perUse: PerUseLimit | null;
}

/** 주체가 받는 요금제. ADMIN은 프리미엄과 같은 기능·한도를 받는다(무제한 경로가 없다). */
export function planOfTier(tier: AccessTier): Plan {
  return match(tier)
    .with("FREE", () => "free" as const)
    .with("PREMIUM", "ADMIN", () => "premium" as const)
    .exhaustive();
}

export function resolveAccessSubject(params: {
  readonly state: AccessState;
  readonly now: Temporal.Instant;
}): AccessSubject {
  const isPremium = hasPaidAccess(params);
  const tier = resolveTier(params.state.role, isPremium);
  return { tier, plan: planOfTier(tier), isPremium };
}

function resolveTier(role: UserRole, isPremium: boolean): AccessTier {
  if (role === USER_ROLE.ADMIN) {
    return "ADMIN";
  }
  return isPremium ? "PREMIUM" : "FREE";
}

function isQuotaFeature(feature: PlanFeature): feature is PlanQuotaFeatureKey {
  return PLAN_CATALOG[feature].kind === "quota";
}

function isLimitFeature(feature: PlanFeature): feature is PlanLimitFeatureKey {
  return PLAN_CATALOG[feature].kind !== "flag";
}

function isGrantableFeature(feature: PlanFeature): feature is GrantableFeature {
  return GRANTABLE_FEATURE_KEYS.some((grantable) => grantable === feature);
}

/** 받은 자리 합계. 0 이하(잘못 저장된 값)는 더하지 않는다. */
function grantedQuantity(grants: FeatureGrants, feature: PlanFeature): number {
  return isGrantableFeature(feature) ? Math.max(0, grants[feature] ?? 0) : 0;
}

/**
 * 요금제 한도에 받은 자리를 더한 표시 한도. 받은 자리는 모든 기능에 이 규칙 하나로 더하고, 무제한(null)은
 * 무제한으로 둔다. 자리를 줄 기능은 GRANTABLE_FEATURE_KEYS에 더하기만 한다.
 */
export function resolveFeatureLimit(params: {
  readonly plan: Plan;
  readonly feature: PlanLimitFeatureKey;
  readonly grants: FeatureGrants;
}): number | null {
  const planLimit = PLAN_CATALOG[params.feature][params.plan];
  return planLimit == null ? null : planLimit + grantedQuantity(params.grants, params.feature);
}

/** 요금제의 기능 하나. quota·resource는 한도가 0보다 크거나 무제한이면 쓸 수 있다. */
export function resolveFeatureEntitlement(params: {
  readonly plan: Plan;
  readonly feature: PlanFeature;
  readonly grants: FeatureGrants;
}): FeatureEntitlement {
  const { plan, feature, grants } = params;
  if (!isLimitFeature(feature)) {
    return { allowed: PLAN_CATALOG[feature][plan], limit: null };
  }
  const limit = resolveFeatureLimit({ plan, feature, grants });
  return { allowed: limit == null || limit > 0, limit };
}

/** 요금제의 모든 기능. 응답 순서는 카탈로그 키 순서다. */
export function resolveFeatureEntitlements(params: {
  readonly plan: Plan;
  readonly grants: FeatureGrants;
}): Record<PlanFeature, FeatureEntitlement> {
  return mapValues(PLAN_CATALOG, (_definition, feature) =>
    resolveFeatureEntitlement({ ...params, feature }),
  );
}

/**
 * 서버가 집행하는 quota 한도. 표시 한도가 무제한인 요금제에 공정 사용 상한이 있으면 그 상한으로 막는다.
 * 출시 앱 응답(/me·/v1/ai/usage)은 표시 한도(null)를 그대로 보여 준다.
 */
export function resolveQuotaLimit(params: {
  readonly plan: Plan;
  readonly feature: PlanQuotaFeatureKey;
}): QuotaLimit {
  const { plan, feature } = params;
  const definition: (typeof PLAN_CATALOG)[PlanQuotaFeatureKey] = PLAN_CATALOG[feature];
  const displayLimit = definition[plan];
  if (displayLimit != null || !("fairUse" in definition) || plan !== "premium") {
    return { limit: displayLimit, isFairUse: false };
  }
  return { limit: definition.fairUse.premium, isFairUse: true };
}

/** 유료 요금제(ADMIN 포함)는 앱을 열지 않아도 활성으로 다룬다. 휴면으로 멈추는 요금제는 free뿐이다. */
export function isExemptFromDormancy(plan: Plan): boolean {
  return plan !== "free";
}

export function calculateRemainingLimit(limit: number | null, used: number): number | null {
  return limit == null ? null : Math.max(0, limit - used);
}

/** 길이 상한이 있는 기능의 요금제별 상한 */
export function resolvePerUseLimit(params: {
  readonly plan: Plan;
  readonly feature: PlanFeature;
}): PerUseLimit | null {
  const definition = PLAN_CATALOG[params.feature];
  if (!("perUse" in definition)) {
    return null;
  }
  return {
    maxSeconds: definition.perUse.maxSeconds[params.plan],
    maxCharacters: definition.perUse.maxCharacters[params.plan],
  };
}

/**
 * 권한 스냅샷에 싣는 resource의 지금 개수. 무제한이면 막을 일이 없으므로 개수를 싣지 않는다(used·remaining
 * null). 다시 채워지지 않아 resetsAt은 null이다.
 */
export function resolveResourceUsage(params: {
  readonly plan: Plan;
  readonly feature: PlanResourceFeatureKey;
  readonly grants: FeatureGrants;
  readonly count: number;
}): FeatureUsageReading | null {
  return resolveFeatureLimit(params) == null ? null : { used: params.count, resetsAt: null };
}

/**
 * 기능 하나의 한도·사용량. quota는 집행 한도(공정 사용 상한 포함)로, resource는 받은 자리를 더한 표시 한도로
 * 계산한다. 사용량을 모르면(usage null) used·remaining·resetsAt은 null이다.
 */
export function resolveFeatureQuota(params: {
  readonly plan: Plan;
  readonly feature: PlanFeature;
  readonly grants: FeatureGrants;
  readonly usage: FeatureUsageReading | null;
}): FeatureQuotaState {
  const { plan, feature, usage } = params;
  const entitlement = resolveFeatureEntitlement(params);
  const quota = isQuotaFeature(feature) ? resolveQuotaLimit({ plan, feature }) : null;
  const limit = quota == null ? entitlement.limit : quota.limit;
  const used = usage?.used ?? null;
  return {
    feature,
    allowed: entitlement.allowed,
    limit,
    used,
    remaining: used == null ? null : calculateRemainingLimit(limit, used),
    period: isQuotaFeature(feature) ? PLAN_CATALOG[feature].period : null,
    resetsAt: usage?.resetsAt ?? null,
    isFairUse: quota?.isFairUse ?? false,
    perUse: resolvePerUseLimit({ plan, feature }),
  };
}

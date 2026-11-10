import {
  PLAN_CATALOG,
  USER_ROLE,
  type AccessTier,
  type PlanFeature,
  type PlanFlagFeatureKey,
  type PlanQuotaFeatureKey,
  type PlanQuotaPeriod,
  type PlanResourceFeatureKey,
  type UserRole,
} from "@aido/api/vocabulary";
import { mapValues } from "es-toolkit";
import { match } from "ts-pattern";

import type { ResourceBonuses } from "./entitlements.constants.js";
import { hasPaidAccess, type PaidAccessState } from "./paid-access.domain-service.js";

/** 권한 판단에 쓰는 사용자 상태. 역할(USER·ADMIN)의 출처는 identity다. */
export interface AccessState extends PaidAccessState {
  readonly role: UserRole;
}

/** 판단 시각의 권한 주체(ACCESS_TIERS). 무료·프리미엄·ADMIN 판단은 여기서만 한다. */
export interface AccessTierDecision {
  readonly tier: AccessTier;
  /** 유효한 스토어 구독이나 보상 기간이 있는지. ADMIN role은 반영하지 않는다. */
  readonly isPremium: boolean;
}

export interface FeatureAccess {
  readonly allowed: boolean;
  /** quota·resource의 표시 한도. null은 무제한이고 flag는 항상 null이다. */
  readonly limit: number | null;
}

/** 서버가 집행하는 quota 한도 */
export interface QuotaLimit {
  /** 이 한도에 닿으면 막는다. null은 정말 무제한(ADMIN·상한 없는 프리미엄)이다. */
  readonly limit: number | null;
  /** 무제한으로 보이는 등급에 걸린 공정 사용 상한인지 */
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
  /** 집행 한도. null은 정말 무제한(ADMIN·flag·상한 없는 resource)이다. */
  readonly limit: number | null;
  /** null은 서버가 이 기능 사용량을 세지 않는다는 뜻이다(flag, 개수를 받지 않았거나 무제한인 resource). */
  readonly used: number | null;
  readonly remaining: number | null;
  readonly period: PlanQuotaPeriod | null;
  readonly resetsAt: Temporal.Instant | null;
  readonly isFairUse: boolean;
  readonly perUse: PerUseLimit | null;
}

/**
 * ADMIN 주체는 카탈로그와 무관하게 모든 기능을 쓸 수 있고 횟수·개수·공정 사용 상한·사용자 비용 예산이 없다.
 * "무제한"은 이 함수 한 곳에서만 판단한다. 역할의 출처는 identity이고 resolveAccessTier가 역할을 주체로 옮긴다.
 */
export function isUnlimitedSubject(subject: { readonly tier: AccessTier }): boolean {
  return subject.tier === "ADMIN";
}

export function resolveAccessTier(params: {
  readonly state: AccessState;
  readonly now: Temporal.Instant;
}): AccessTierDecision {
  const isPremium = hasPaidAccess(params);
  if (params.state.role === USER_ROLE.ADMIN) {
    return { tier: "ADMIN", isPremium };
  }
  return { tier: isPremium ? "PREMIUM" : "FREE", isPremium };
}

// ADMIN 값은 isUnlimitedSubject가 먼저 걸러 내 여기서는 쓰이지 않는다
function pickTierValue<T>(tier: AccessTier, values: { readonly free: T; readonly premium: T }): T {
  return match(tier)
    .with("PREMIUM", () => values.premium)
    .with("FREE", "ADMIN", () => values.free)
    .exhaustive();
}

function addBonus(limit: number | null, bonus: number): number | null {
  return limit == null ? null : limit + bonus;
}

function isQuotaFeature(feature: PlanFeature): feature is PlanQuotaFeatureKey {
  return PLAN_CATALOG[feature].kind === "quota";
}

/** 한 주체의 기능 권한. quota·resource는 한도가 0보다 크거나 무제한이면 쓸 수 있다. */
export function resolveFeatureAccess(params: {
  readonly tier: AccessTier;
  readonly feature: PlanFeature;
  readonly resourceBonuses: ResourceBonuses;
}): FeatureAccess {
  const { tier, feature, resourceBonuses } = params;
  const definition = PLAN_CATALOG[feature];
  const isUnlimited = isUnlimitedSubject({ tier });
  if (definition.kind === "flag") {
    return { allowed: isUnlimited || pickTierValue(tier, definition), limit: null };
  }
  const limit = isUnlimited
    ? null
    : addBonus(pickTierValue(tier, definition), feature === "FRIEND" ? resourceBonuses.FRIEND : 0);
  return { allowed: limit == null || limit > 0, limit };
}

/** 카탈로그의 모든 기능 권한. 응답 순서는 카탈로그 키 순서다. */
export function resolveAllFeatureAccess(params: {
  readonly tier: AccessTier;
  readonly resourceBonuses: ResourceBonuses;
}): Record<PlanFeature, FeatureAccess> {
  return mapValues(PLAN_CATALOG, (_definition, feature) =>
    resolveFeatureAccess({ ...params, feature }),
  );
}

/**
 * 서버가 집행하는 quota 한도. 표시 한도가 무제한인 등급에 공정 사용 상한이 있으면 그 상한으로 막는다.
 * 출시 앱 응답(/me·/v1/ai/usage)은 표시 한도(null)를 그대로 보여 준다.
 */
export function resolveQuotaLimit(params: {
  readonly tier: AccessTier;
  readonly feature: PlanQuotaFeatureKey;
}): QuotaLimit {
  const { tier, feature } = params;
  if (isUnlimitedSubject({ tier })) {
    return { limit: null, isFairUse: false };
  }
  const definition: (typeof PLAN_CATALOG)[PlanQuotaFeatureKey] = PLAN_CATALOG[feature];
  const displayLimit = pickTierValue(tier, definition);
  if (displayLimit != null || !("fairUse" in definition) || tier !== "PREMIUM") {
    return { limit: displayLimit, isFairUse: false };
  }
  return { limit: definition.fairUse.premium, isFairUse: true };
}

/** 유료·ADMIN은 앱을 열지 않아도 활성으로 다룬다. 휴면으로 멈추는 등급은 FREE뿐이다. */
export function isExemptFromDormancy(tier: AccessTier): boolean {
  return tier !== "FREE";
}

export function calculateRemainingLimit(limit: number | null, used: number): number | null {
  return limit == null ? null : Math.max(0, limit - used);
}

/** 길이 상한이 있는 기능의 등급별 상한. 무제한 주체는 가장 큰(프리미엄) 상한을 쓴다. */
export function resolvePerUseLimit(params: {
  readonly tier: AccessTier;
  readonly feature: PlanFeature;
}): PerUseLimit | null {
  const definition = PLAN_CATALOG[params.feature];
  if (!("perUse" in definition)) {
    return null;
  }
  const valueTier = isUnlimitedSubject(params) ? "PREMIUM" : params.tier;
  return {
    maxSeconds: pickTierValue(valueTier, definition.perUse.maxSeconds),
    maxCharacters: pickTierValue(valueTier, definition.perUse.maxCharacters),
  };
}

/**
 * 권한 스냅샷에 싣는 resource의 지금 개수. 무제한이면 막을 일이 없으므로 개수를 싣지 않는다(used·remaining
 * null). 다시 채워지지 않아 resetsAt은 null이다.
 */
export function resolveResourceUsage(params: {
  readonly tier: AccessTier;
  readonly feature: PlanResourceFeatureKey;
  readonly resourceBonuses: ResourceBonuses;
  readonly count: number;
}): FeatureUsageReading | null {
  const { limit } = resolveFeatureAccess(params);
  return limit == null ? null : { used: params.count, resetsAt: null };
}

/**
 * 기능 하나의 한도·사용량. quota는 집행 한도(공정 사용 상한 포함)로, resource는 보너스를 더한 표시 한도로
 * 계산한다. 사용량을 모르면(usage null) used·remaining·resetsAt은 null이다.
 */
export function resolveFeatureQuota(params: {
  readonly tier: AccessTier;
  readonly feature: PlanFeature;
  readonly resourceBonuses: ResourceBonuses;
  readonly usage: FeatureUsageReading | null;
}): FeatureQuotaState {
  const { tier, feature, usage } = params;
  const access = resolveFeatureAccess(params);
  const quota = isQuotaFeature(feature) ? resolveQuotaLimit({ tier, feature }) : null;
  const limit = quota == null ? access.limit : quota.limit;
  const used = usage?.used ?? null;
  return {
    feature,
    allowed: access.allowed,
    limit,
    used,
    remaining: used == null ? null : calculateRemainingLimit(limit, used),
    period: isQuotaFeature(feature) ? PLAN_CATALOG[feature].period : null,
    resetsAt: usage?.resetsAt ?? null,
    isFairUse: quota?.isFairUse ?? false,
    perUse: resolvePerUseLimit({ tier, feature }),
  };
}

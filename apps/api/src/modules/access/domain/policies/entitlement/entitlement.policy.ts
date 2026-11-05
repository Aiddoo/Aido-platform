import {
  PLAN_CATALOG,
  type AccessTier,
  type PlanFeature,
  type PlanFlagFeatureKey,
  type PlanQuotaFeatureKey,
  type PlanQuotaPeriod,
} from "@aido/api/vocabulary";
import { mapValues } from "es-toolkit";
import { match } from "ts-pattern";

import { hasPaidAccess, type PaidAccessState } from "./paid-access.policy.js";

/**
 * 권한 주체(ACCESS_TIERS). PREMIUM은 유효한 스토어 구독이나 보상 기간이고, ADMIN은 카탈로그와 무관하게
 * 모든 한도가 무제한이고 모든 기능을 쓸 수 있다.
 */
export type { AccessTier };

export interface AccessState extends PaidAccessState {
  readonly role: string;
}

/** 판단 시각의 권한 주체. 무료·프리미엄 판단은 여기서만 한다. */
export interface AccessContext {
  readonly tier: AccessTier;
  /** 유효한 스토어 구독이나 보상 기간이 있는지. ADMIN role은 반영하지 않는다. */
  readonly isPremium: boolean;
}

/** 보너스 자리를 줄 수 있는 리소스. 저장소 ResourceType과 같은 값이다. */
export type BonusResource = "FRIEND";

/** 초대 보상 등으로 늘어난 리소스 자리 수 */
export type ResourceBonuses = Readonly<Record<BonusResource, number>>;
export const NO_RESOURCE_BONUSES: ResourceBonuses = { FRIEND: 0 };

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

export function resolveAccessContext(state: AccessState, at: Date): AccessContext {
  const isPremium = hasPaidAccess(state, at);
  if (state.role === "ADMIN") {
    return { tier: "ADMIN", isPremium };
  }
  return { tier: isPremium ? "PREMIUM" : "FREE", isPremium };
}

function tierValue<T>(tier: AccessTier, values: { readonly free: T; readonly premium: T }): T {
  return match(tier)
    .with("PREMIUM", () => values.premium)
    .with("FREE", "ADMIN", () => values.free)
    .exhaustive();
}

function withBonus(limit: number | null, bonus: number): number | null {
  return limit == null ? null : limit + bonus;
}

/** 한 주체의 기능 권한. quota·resource는 한도가 0보다 크거나 무제한이면 쓸 수 있다. */
export function resolveFeatureAccess(
  tier: AccessTier,
  feature: PlanFeature,
  resourceBonuses: ResourceBonuses,
): FeatureAccess {
  const definition = PLAN_CATALOG[feature];
  if (definition.kind === "flag") {
    return { allowed: tier === "ADMIN" || tierValue(tier, definition), limit: null };
  }
  const limit =
    tier === "ADMIN"
      ? null
      : withBonus(tierValue(tier, definition), feature === "FRIEND" ? resourceBonuses.FRIEND : 0);
  return { allowed: limit == null || limit > 0, limit };
}

/** 카탈로그의 모든 기능 권한. 응답 순서는 카탈로그 키 순서다. */
export function resolveAllFeatureAccess(
  tier: AccessTier,
  resourceBonuses: ResourceBonuses,
): Record<PlanFeature, FeatureAccess> {
  return mapValues(PLAN_CATALOG, (_definition, feature) =>
    resolveFeatureAccess(tier, feature, resourceBonuses),
  );
}

/**
 * 서버가 집행하는 quota 한도. 표시 한도가 무제한인 등급에 공정 사용 상한이 있으면 그 상한으로 막는다.
 * 출시 앱 응답(/me·/v1/ai/usage)은 표시 한도(null)를 그대로 보여 준다.
 */
export function resolveQuotaLimit(tier: AccessTier, feature: PlanQuotaFeatureKey): QuotaLimit {
  if (tier === "ADMIN") {
    return { limit: null, isFairUse: false };
  }
  const definition: (typeof PLAN_CATALOG)[PlanQuotaFeatureKey] = PLAN_CATALOG[feature];
  const displayLimit = tierValue(tier, definition);
  if (displayLimit != null || !("fairUse" in definition) || tier !== "PREMIUM") {
    return { limit: displayLimit, isFairUse: false };
  }
  return { limit: definition.fairUse.premium, isFairUse: true };
}

/**
 * ADMIN은 횟수·공정 사용 상한이 없으므로 사용자 일 비용 예산에서도 빠진다. 사용량 기록과 전역 예산·
 * 킬 스위치·입력 상한은 등급과 상관없이 그대로다.
 */
export function isExemptFromUserSpendLimit(tier: AccessTier): boolean {
  return tier === "ADMIN";
}

/** 유료·ADMIN은 앱을 열지 않아도 활성으로 다룬다. 휴면으로 멈추는 등급은 FREE뿐이다. */
export function isExemptFromDormancy(tier: AccessTier): boolean {
  return tier !== "FREE";
}

export function calculateRemainingLimit(limit: number | null, used: number): number | null {
  return limit == null ? null : Math.max(0, limit - used);
}

export function isQuotaFeature(feature: PlanFeature): feature is PlanQuotaFeatureKey {
  return PLAN_CATALOG[feature].kind === "quota";
}

export interface PerUseLimit {
  readonly maxSeconds: number;
  readonly maxCharacters: number;
}

/** 길이 상한이 있는 기능의 등급별 상한. ADMIN은 가장 큰(프리미엄) 상한을 쓴다. */
export function resolvePerUseLimit(tier: AccessTier, feature: PlanFeature): PerUseLimit | null {
  const definition = PLAN_CATALOG[feature];
  if (!("perUse" in definition)) {
    return null;
  }
  const valueTier = tier === "ADMIN" ? "PREMIUM" : tier;
  return {
    maxSeconds: tierValue(valueTier, definition.perUse.maxSeconds),
    maxCharacters: tierValue(valueTier, definition.perUse.maxCharacters),
  };
}

/** 기능 하나의 현재 사용량. resource(친구·카테고리)는 다시 채워지지 않아 resetsAt이 null이다. */
export interface FeatureUsageReading {
  readonly used: number;
  readonly resetsAt: Date | null;
}

/** 한 기간의 사용량. 소유 Context(계량기·응원·찌르기)가 센다. */
export interface QuotaUsageReading extends FeatureUsageReading {
  readonly resetsAt: Date;
}

/** 서버가 계산한 기능 하나의 한도와 사용량. 공개 계약 featureQuota의 원본이다. */
export interface FeatureQuotaState {
  readonly feature: PlanFeature;
  readonly allowed: boolean;
  /** 집행 한도. null은 정말 무제한(ADMIN·flag·상한 없는 resource)이다. */
  readonly limit: number | null;
  /** null은 서버가 이 기능 사용량을 세지 않는다는 뜻이다(resource·flag). */
  readonly used: number | null;
  readonly remaining: number | null;
  readonly period: PlanQuotaPeriod | null;
  readonly resetsAt: Date | null;
  readonly isFairUse: boolean;
  readonly perUse: PerUseLimit | null;
}

/**
 * 기능 하나의 한도·사용량. quota는 집행 한도(공정 사용 상한 포함)로, resource는 보너스를 더한 표시 한도로
 * 계산한다. 사용량을 모르면(usage null) used·remaining·resetsAt은 null이다.
 */
export function resolveFeatureQuota(input: {
  readonly tier: AccessTier;
  readonly feature: PlanFeature;
  readonly resourceBonuses: ResourceBonuses;
  readonly usage: FeatureUsageReading | null;
}): FeatureQuotaState {
  const { tier, feature, usage } = input;
  const access = resolveFeatureAccess(tier, feature, input.resourceBonuses);
  const quota = isQuotaFeature(feature) ? resolveQuotaLimit(tier, feature) : null;
  const limit = quota == null ? access.limit : quota.limit;
  const used = usage?.used ?? null;
  return {
    feature,
    allowed: access.allowed,
    limit,
    used,
    remaining: used == null ? null : calculateRemainingLimit(limit, used),
    period: isQuotaFeature(feature) ? PLAN_CATALOG[feature].period : null,
    resetsAt: usage?.resetsAt == null ? null : new Date(usage.resetsAt),
    isFairUse: quota?.isFairUse ?? false,
    perUse: resolvePerUseLimit(tier, feature),
  };
}

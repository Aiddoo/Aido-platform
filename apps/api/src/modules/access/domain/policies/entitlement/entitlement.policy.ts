import {
  PLAN_CATALOG,
  type PlanFeature,
  type PlanFlagFeatureKey,
  type PlanQuotaFeatureKey,
} from "@aido/api/vocabulary";
import { mapValues } from "es-toolkit";
import { match } from "ts-pattern";

import { hasPaidAccess, type PaidAccessState } from "./paid-access.policy.js";

/**
 * 권한 주체. PREMIUM은 유효한 스토어 구독이나 보상 기간이고, ADMIN은 카탈로그와 무관하게 모든 한도가
 * 무제한이고 모든 기능을 쓸 수 있다.
 */
export type AccessTier = "FREE" | "PREMIUM" | "ADMIN";

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

/** 무제한(null)은 그대로 두고 한도가 있으면 보너스 자리를 더한다. */
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

export function calculateRemainingLimit(limit: number | null, used: number): number | null {
  return limit == null ? null : Math.max(0, limit - used);
}

import {
  SUBSCRIPTION_AI_PARSE_LIMITS,
  SUBSCRIPTION_CHEER_LIMITS,
  SUBSCRIPTION_FOLLOW_LIMITS,
  SUBSCRIPTION_NUDGE_LIMITS,
  SUBSCRIPTION_TODO_CATEGORY_LIMITS,
} from "@aido/api/vocabulary";
import { maxBy } from "es-toolkit";
import { match } from "ts-pattern";

import { storeRenewalGraceEndsAt } from "#api/shared/domain/store-renewal-grace";

export type Feature = "CHEER" | "NUDGE" | "AI_PARSE";
export const Feature = { CHEER: "CHEER", NUDGE: "NUDGE", AI_PARSE: "AI_PARSE" } satisfies Record<
  Feature,
  Feature
>;
export type Resource = "CATEGORY" | "FRIEND";
export const Resource = { CATEGORY: "CATEGORY", FRIEND: "FRIEND" } satisfies Record<
  Resource,
  Resource
>;

export type SubscriptionStatusValue = keyof typeof SUBSCRIPTION_AI_PARSE_LIMITS;

/** 보너스 자리를 줄 수 있는 리소스. 저장소 ResourceType과 같은 값이다. */
export type BonusResource = Extract<Resource, "FRIEND">;

/** 초대 보상 등으로 늘어난 리소스 자리 수 */
export type ResourceBonuses = Readonly<Record<Resource, number>>;
export const NO_RESOURCE_BONUSES: ResourceBonuses = { CATEGORY: 0, FRIEND: 0 };

type SubscriptionLimits = Readonly<Record<SubscriptionStatusValue, number | null>>;
const FEATURE_LIMITS: Readonly<Record<Feature, SubscriptionLimits>> = {
  CHEER: SUBSCRIPTION_CHEER_LIMITS,
  NUDGE: SUBSCRIPTION_NUDGE_LIMITS,
  AI_PARSE: SUBSCRIPTION_AI_PARSE_LIMITS,
};
const RESOURCE_LIMITS: Readonly<Record<Resource, SubscriptionLimits>> = {
  CATEGORY: SUBSCRIPTION_TODO_CATEGORY_LIMITS,
  FRIEND: SUBSCRIPTION_FOLLOW_LIMITS,
};

/** 저장소의 모르는 상태 문자열은 무료로 본다. */
export function toSubscriptionStatus(value: string): SubscriptionStatusValue {
  return match(value)
    .with("FREE", "ACTIVE", "EXPIRED", "CANCELLED", (status) => status)
    .otherwise(() => "FREE");
}

function resolveLimit(
  role: string,
  subscriptionStatus: string,
  limits: SubscriptionLimits,
): number | null {
  if (role === "ADMIN") return null;
  return match(toSubscriptionStatus(subscriptionStatus))
    .with("FREE", () => limits.FREE)
    .with("ACTIVE", () => limits.ACTIVE)
    .with("EXPIRED", () => limits.EXPIRED)
    .with("CANCELLED", () => limits.CANCELLED)
    .exhaustive();
}

export function resolveFeatureLimit(
  role: string,
  subscriptionStatus: string,
  feature: Feature,
): number | null {
  return resolveLimit(role, subscriptionStatus, FEATURE_LIMITS[feature]);
}

/** 무제한(null)은 그대로 두고 한도가 있으면 보너스 자리를 더한다. */
export function resolveResourceLimit(
  role: string,
  subscriptionStatus: string,
  resource: Resource,
  bonus: number,
): number | null {
  const limit = resolveLimit(role, subscriptionStatus, RESOURCE_LIMITS[resource]);
  return limit === null ? null : limit + bonus;
}

export function hasPremiumEntitlement(role: string, subscriptionStatus: string): boolean {
  return role === "ADMIN" || subscriptionStatus === "ACTIVE";
}

export function calculateRemainingLimit(limit: number | null, used: number): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}

export interface PremiumAccessDeadlineInput {
  readonly subscriptionExpiresAt: Date | null;
  /** 다른 사용자에게 옮겨 가지 않은 자동 갱신(ACTIVE) 스토어 구독의 만료 시각 */
  readonly renewingStoreExpiresAt: readonly Date[];
}

/**
 * User projection이 ACTIVE여도 프리미엄이 끝나는 시각.
 * 보상 기간은 projection의 만료 시각에 정확히 끝나고, 자동 갱신 중인 스토어 구독은 갱신 웹훅을 기다리는
 * 유예 시간까지 이어진다. 만료 시각이 없으면 웹훅이 상태를 바꿀 때까지 유지하던 기존 동작을 따른다.
 */
export function resolvePremiumAccessDeadline(input: PremiumAccessDeadlineInput): Date | null {
  const { subscriptionExpiresAt } = input;
  if (subscriptionExpiresAt == null) return null;
  return (
    maxBy(
      [subscriptionExpiresAt, ...input.renewingStoreExpiresAt.map(storeRenewalGraceEndsAt)],
      (date) => date.getTime(),
    ) ?? subscriptionExpiresAt
  );
}

/** 끝나는 시각이 지난 ACTIVE projection은 정리 작업이 돌기 전이라도 만료로 본다. */
export function resolveEffectiveSubscriptionStatus(
  subscriptionStatus: string,
  accessDeadline: Date | null,
  now: Date,
): string {
  return subscriptionStatus === "ACTIVE" &&
    accessDeadline != null &&
    accessDeadline.getTime() <= now.getTime()
    ? "EXPIRED"
    : subscriptionStatus;
}

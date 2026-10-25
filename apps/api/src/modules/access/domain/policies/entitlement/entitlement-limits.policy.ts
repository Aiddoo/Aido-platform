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

type SubscriptionLimits = Readonly<
  Record<keyof typeof SUBSCRIPTION_AI_PARSE_LIMITS, number | null>
>;
const FEATURE_LIMITS: Readonly<Record<Feature, SubscriptionLimits>> = {
  CHEER: SUBSCRIPTION_CHEER_LIMITS,
  NUDGE: SUBSCRIPTION_NUDGE_LIMITS,
  AI_PARSE: SUBSCRIPTION_AI_PARSE_LIMITS,
};
const RESOURCE_LIMITS: Readonly<Record<Resource, SubscriptionLimits>> = {
  CATEGORY: SUBSCRIPTION_TODO_CATEGORY_LIMITS,
  FRIEND: SUBSCRIPTION_FOLLOW_LIMITS,
};

function resolveLimit(
  role: string,
  subscriptionStatus: string,
  limits: SubscriptionLimits,
): number | null {
  if (role === "ADMIN") return null;
  return match(subscriptionStatus)
    .with("FREE", "ACTIVE", "EXPIRED", "CANCELLED", (status) => limits[status])
    .otherwise(() => limits.FREE);
}

export function resolveFeatureLimit(
  role: string,
  subscriptionStatus: string,
  feature: Feature,
): number | null {
  return resolveLimit(role, subscriptionStatus, FEATURE_LIMITS[feature]);
}

export function resolveResourceLimit(
  role: string,
  subscriptionStatus: string,
  resource: Resource,
): number | null {
  return resolveLimit(role, subscriptionStatus, RESOURCE_LIMITS[resource]);
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

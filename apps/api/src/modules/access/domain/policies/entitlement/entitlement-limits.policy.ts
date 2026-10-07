import {
  SUBSCRIPTION_AI_PARSE_LIMITS,
  SUBSCRIPTION_CHEER_LIMITS,
  SUBSCRIPTION_FOLLOW_LIMITS,
  SUBSCRIPTION_NUDGE_LIMITS,
  SUBSCRIPTION_TODO_CATEGORY_LIMITS,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

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

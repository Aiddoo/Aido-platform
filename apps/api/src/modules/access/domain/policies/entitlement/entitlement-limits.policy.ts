import {
  PREMIUM_FEATURES,
  type PremiumFeature,
  type PremiumFlagFeatureKey,
  type PremiumLimitFeatureKey,
} from "@aido/api/vocabulary";
import { mapValues, maxBy } from "es-toolkit";
import { match } from "ts-pattern";

import {
  storeEntitlementEndsAt,
  type StoreEntitlementWindow,
} from "#api/shared/domain/store-renewal-grace";

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

export type SubscriptionStatusValue = "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED";

/** 보너스 자리를 줄 수 있는 리소스. 저장소 ResourceType과 같은 값이다. */
export type BonusResource = Extract<Resource, "FRIEND">;

/** 초대 보상 등으로 늘어난 리소스 자리 수 */
export type ResourceBonuses = Readonly<Record<Resource, number>>;
export const NO_RESOURCE_BONUSES: ResourceBonuses = { CATEGORY: 0, FRIEND: 0 };

/**
 * 권한 주체. PREMIUM은 유효한 스토어 구독이나 보상 기간(만료·유예 반영 뒤 ACTIVE)이고, ADMIN은 카탈로그와
 * 무관하게 모든 한도가 무제한이고 모든 기능을 쓸 수 있다.
 */
export type AccessTier = "FREE" | "PREMIUM" | "ADMIN";

export interface FeatureAccess {
  readonly allowed: boolean;
  /** quota·resource의 한도. null은 무제한이고 flag는 항상 null이다. */
  readonly limit: number | null;
}

/** 서버가 판단하는 flag. 앱만 막는 기능(clientOnly)은 뺀다. */
export type ServerFlagFeature = Exclude<PremiumFlagFeatureKey, "APP_ICON">;

const FEATURE_CATALOG_KEY = {
  CHEER: "CHEER",
  NUDGE: "NUDGE",
  AI_PARSE: "AI_PARSE",
} as const satisfies Record<Feature, PremiumLimitFeatureKey>;
const RESOURCE_CATALOG_KEY = {
  CATEGORY: "TODO_CATEGORY",
  FRIEND: "FRIEND",
} as const satisfies Record<Resource, PremiumLimitFeatureKey>;
const RESOURCE_OF_CATALOG_KEY: Partial<Record<PremiumFeature, Resource>> = {
  TODO_CATEGORY: Resource.CATEGORY,
  FRIEND: Resource.FRIEND,
};

/** 저장소의 모르는 상태 문자열은 무료로 본다. */
export function toSubscriptionStatus(value: string): SubscriptionStatusValue {
  return match(value)
    .with("FREE", "ACTIVE", "EXPIRED", "CANCELLED", (status) => status)
    .otherwise(() => "FREE");
}

/** 만료를 반영한 구독 상태로 주체를 정한다. EXPIRED·CANCELLED·모르는 상태는 FREE다. */
export function resolveAccessTier(role: string, effectiveSubscriptionStatus: string): AccessTier {
  if (role === "ADMIN") {
    return "ADMIN";
  }
  return toSubscriptionStatus(effectiveSubscriptionStatus) === "ACTIVE" ? "PREMIUM" : "FREE";
}

function tierLimit(
  tier: AccessTier,
  definition: { readonly free: number; readonly premium: number | null },
): number | null {
  return match(tier)
    .with("ADMIN", () => null)
    .with("PREMIUM", () => definition.premium)
    .with("FREE", () => definition.free)
    .exhaustive();
}

/** 무제한(null)은 그대로 두고 한도가 있으면 보너스 자리를 더한다. */
function withBonus(limit: number | null, bonus: number): number | null {
  return limit == null ? null : limit + bonus;
}

/** 한 주체의 기능 권한. quota·resource는 한도가 0보다 크거나 무제한이면 쓸 수 있다. */
export function resolveFeatureAccess(
  tier: AccessTier,
  feature: PremiumFeature,
  resourceBonuses: ResourceBonuses,
): FeatureAccess {
  const definition = PREMIUM_FEATURES[feature];
  if (definition.kind === "flag") {
    const allowed = match(tier)
      .with("ADMIN", () => true)
      .with("PREMIUM", () => definition.premium)
      .with("FREE", () => definition.free)
      .exhaustive();
    return { allowed, limit: null };
  }
  const resource = RESOURCE_OF_CATALOG_KEY[feature];
  const limit = withBonus(
    tierLimit(tier, definition),
    resource == null ? 0 : resourceBonuses[resource],
  );
  return { allowed: limit == null || limit > 0, limit };
}

/** 카탈로그의 모든 기능 권한. 응답 순서는 카탈로그 키 순서다. */
export function resolveAllFeatureAccess(
  tier: AccessTier,
  resourceBonuses: ResourceBonuses,
): Record<PremiumFeature, FeatureAccess> {
  return mapValues(PREMIUM_FEATURES, (_definition, feature) =>
    resolveFeatureAccess(tier, feature, resourceBonuses),
  );
}

export function resolveFeatureLimit(
  role: string,
  subscriptionStatus: string,
  feature: Feature,
): number | null {
  return tierLimit(
    resolveAccessTier(role, subscriptionStatus),
    PREMIUM_FEATURES[FEATURE_CATALOG_KEY[feature]],
  );
}

export function resolveResourceLimit(
  role: string,
  subscriptionStatus: string,
  resource: Resource,
  bonus: number,
): number | null {
  return withBonus(
    tierLimit(
      resolveAccessTier(role, subscriptionStatus),
      PREMIUM_FEATURES[RESOURCE_CATALOG_KEY[resource]],
    ),
    bonus,
  );
}

export function calculateRemainingLimit(limit: number | null, used: number): number | null {
  return limit == null ? null : Math.max(0, limit - used);
}

export interface PremiumAccessDeadlineInput {
  readonly subscriptionExpiresAt: Date | null;
  /** 다른 사용자에게 옮겨 가지 않은 ACTIVE·CANCELLED 스토어 구독 행 */
  readonly storeEntitlements: readonly StoreEntitlementWindow[];
}

/**
 * User projection이 ACTIVE여도 프리미엄이 끝나는 시각.
 * 보상 기간은 projection의 만료 시각에 정확히 끝나고, 스토어 구독은 storeEntitlementEndsAt(웹훅 대기
 * 유예·결제 유예 포함)까지 이어진다. 만료 시각이 없으면 웹훅이 상태를 바꿀 때까지 유지하던 기존 동작을 따른다.
 */
export function resolvePremiumAccessDeadline(input: PremiumAccessDeadlineInput): Date | null {
  const { subscriptionExpiresAt } = input;
  if (subscriptionExpiresAt == null) {
    return null;
  }
  return (
    maxBy(
      [
        subscriptionExpiresAt,
        ...input.storeEntitlements.flatMap((store) => storeEntitlementEndsAt(store) ?? []),
      ],
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

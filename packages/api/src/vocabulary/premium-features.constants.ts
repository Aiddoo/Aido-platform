import { AI_PARSE_LIMITS } from "./ai.constants.js";
import { CHEER_LIMITS } from "./cheer.constants.js";
import { FOLLOW_LIMITS } from "./follow.constants.js";
import { NUDGE_LIMITS } from "./nudge.constants.js";
import { TODO_CATEGORY_LIMITS } from "./todo-category.constants.js";

/** 한도를 다시 채우는 주기. day·month 경계는 기능별 서버 규칙(사용자 시간대·KST)을 따른다. */
export type PremiumQuotaPeriod = "day" | "month";

/** 기간마다 쓸 수 있는 횟수. null은 무제한이다. */
export interface PremiumQuotaFeature {
  readonly kind: "quota";
  readonly period: PremiumQuotaPeriod;
  readonly free: number;
  readonly premium: number | null;
}

/** 동시에 가질 수 있는 개수. null은 무제한이다. 보상으로 받은 자리는 서버가 더한다. */
export interface PremiumResourceFeature {
  readonly kind: "resource";
  readonly free: number;
  readonly premium: number | null;
}

/** 켜고 끄는 기능 */
export interface PremiumFlagFeature {
  readonly kind: "flag";
  readonly free: boolean;
  readonly premium: boolean;
  /** 서버가 판단하지 않고 앱만 막는 기능 */
  readonly clientOnly?: true;
}

export type PremiumFeatureDefinition =
  | PremiumQuotaFeature
  | PremiumResourceFeature
  | PremiumFlagFeature;

/** 유료 기능 키. 순서는 앱 표시·응답 정렬 순서다. */
export const PREMIUM_FEATURE_KEYS = [
  "AI_PARSE",
  "CHEER",
  "NUDGE",
  "FRIEND",
  "TODO_CATEGORY",
  "AI_REPORT",
  "AI_SUGGESTION",
  "CUSTOM_REMINDER_TIME",
  "APP_ICON",
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURE_KEYS)[number];

/**
 * 유료 기능 전체 목록. 등급은 무료(free)와 프리미엄(premium) 둘이고, ADMIN은 서버 정책이 모든 기능을
 * 무제한으로 연다. 새 유료 기능은 여기에 먼저 추가한다.
 */
export const PREMIUM_FEATURES = {
  AI_PARSE: {
    kind: "quota",
    period: "month",
    free: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
    premium: null,
  },
  CHEER: { kind: "quota", period: "day", free: CHEER_LIMITS.FREE_DAILY_LIMIT, premium: null },
  NUDGE: { kind: "quota", period: "day", free: NUDGE_LIMITS.FREE_DAILY_LIMIT, premium: null },
  FRIEND: { kind: "resource", free: FOLLOW_LIMITS.FREE_MAX_FRIENDS, premium: null },
  TODO_CATEGORY: {
    kind: "resource",
    free: TODO_CATEGORY_LIMITS.FREE_MAX_COUNT,
    premium: TODO_CATEGORY_LIMITS.ACTIVE_MAX_COUNT,
  },
  AI_REPORT: { kind: "flag", free: false, premium: true },
  AI_SUGGESTION: { kind: "flag", free: false, premium: true },
  CUSTOM_REMINDER_TIME: { kind: "flag", free: false, premium: true },
  APP_ICON: { kind: "flag", free: false, premium: true, clientOnly: true },
} as const satisfies Record<PremiumFeature, PremiumFeatureDefinition>;

type FeaturesOfKind<TKind extends PremiumFeatureDefinition["kind"]> = {
  [TFeature in PremiumFeature]: (typeof PREMIUM_FEATURES)[TFeature]["kind"] extends TKind
    ? TFeature
    : never;
}[PremiumFeature];

export type PremiumQuotaFeatureKey = FeaturesOfKind<"quota">;
export type PremiumResourceFeatureKey = FeaturesOfKind<"resource">;
export type PremiumLimitFeatureKey = PremiumQuotaFeatureKey | PremiumResourceFeatureKey;
export type PremiumFlagFeatureKey = FeaturesOfKind<"flag">;

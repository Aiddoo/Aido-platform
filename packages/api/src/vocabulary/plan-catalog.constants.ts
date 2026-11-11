/** 한도를 다시 채우는 주기. day·month 경계는 기능별 서버 규칙(사용자 시간대·KST)을 따른다. */
export const PLAN_QUOTA_PERIODS = ["day", "month"] as const;

export type PlanQuotaPeriod = (typeof PLAN_QUOTA_PERIODS)[number];

/**
 * 권한 주체(누구인가). 출시 앱이 표시에 쓴다. 기능 값은 주체가 아니라 요금제(PLANS)로 정하고, ADMIN 주체는
 * premium 요금제를 받는다(무제한이 아니다).
 */
export const ACCESS_TIERS = ["FREE", "PREMIUM", "ADMIN"] as const;

export type AccessTier = (typeof ACCESS_TIERS)[number];

/** 기능 값을 정하는 요금제. PLAN_CATALOG 기능마다 이 키로 값을 둔다. */
export const PLANS = ["free", "premium"] as const;

export type Plan = (typeof PLANS)[number];

/** 서버가 원장(QuotaUsage·QuotaCharge)으로 세는 사용량 계량기 */
export const QUOTA_METERS = ["AI_PLAN", "VOICE_NOTE"] as const;

export type QuotaMeter = (typeof QUOTA_METERS)[number];

/**
 * 차감 한 건(QuotaCharge)의 상태. AI 호출 전 RESERVED로 잡고, 결과를 주면 COMMITTED,
 * 실패·빈 결과면 REFUNDED(정확히 한 번)로 바꾼다.
 */
export const QUOTA_CHARGE_STATUSES = ["RESERVED", "COMMITTED", "REFUNDED"] as const;

export type QuotaChargeStatus = (typeof QUOTA_CHARGE_STATUSES)[number];

/** 요금제별 값 */
type PlanValues<T> = { readonly [TPlan in Plan]: T };

/**
 * 기간마다 쓸 수 있는 횟수. premium null은 사용자에게 무제한으로 보이는 한도다.
 * fairUse.premium은 무제한으로 보이는 프리미엄에서도 남용을 막으려고 서버가 집행하는 공정 사용 상한이다.
 */
interface PlanQuotaFeature {
  readonly kind: "quota";
  readonly period: PlanQuotaPeriod;
  readonly free: number;
  readonly premium: number | null;
  readonly meter?: QuotaMeter;
  readonly fairUse?: { readonly premium: number };
  /** 한 번 쓸 때의 길이 상한. 앱 타이머가 초로 먼저 막고 서버는 확인할 수 있는 글자 수로 다시 막는다. */
  readonly perUse?: {
    readonly maxSeconds: PlanValues<number>;
    readonly maxCharacters: PlanValues<number>;
  };
}

/** 동시에 가질 수 있는 개수. null은 무제한이다. 받은 자리(GRANTABLE_FEATURE_KEYS)는 서버가 더한다. */
interface PlanResourceFeature {
  readonly kind: "resource";
  readonly free: number;
  readonly premium: number | null;
}

/** 켜고 끄는 기능 */
interface PlanFlagFeature {
  readonly kind: "flag";
  readonly free: boolean;
  readonly premium: boolean;
  /** 서버가 판단하지 않고 앱만 막는 기능 */
  readonly clientOnly?: true;
}

type PlanFeatureDefinition = PlanQuotaFeature | PlanResourceFeature | PlanFlagFeature;

/** 출시 앱의 /me.entitlements가 아는 기능 키. 순서는 앱 표시·응답 정렬 순서다. */
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

/** 1.15.0부터 더한 기능까지 포함한 전체 키. 순서는 GET /v1/entitlements 응답 순서다. */
export const PLAN_FEATURE_KEYS = [...PREMIUM_FEATURE_KEYS, "VOICE_NOTE"] as const;

export type PlanFeature = (typeof PLAN_FEATURE_KEYS)[number];

/** 출시 앱(1.13·1.14)이 읽는 기능들. 플랜 숫자는 이 파일에서만 고친다. */
export const PREMIUM_FEATURES = {
  AI_PARSE: {
    kind: "quota",
    period: "month",
    meter: "AI_PLAN",
    free: 10,
    premium: null,
    fairUse: { premium: 1000 },
  },
  CHEER: { kind: "quota", period: "day", free: 3, premium: null },
  NUDGE: { kind: "quota", period: "day", free: 3, premium: null },
  FRIEND: { kind: "resource", free: 5, premium: null },
  TODO_CATEGORY: { kind: "resource", free: 3, premium: 30 },
  AI_REPORT: { kind: "flag", free: false, premium: true },
  AI_SUGGESTION: { kind: "flag", free: false, premium: true },
  CUSTOM_REMINDER_TIME: { kind: "flag", free: false, premium: true },
  APP_ICON: { kind: "flag", free: false, premium: true, clientOnly: true },
} as const satisfies Record<PremiumFeature, PlanFeatureDefinition>;

/**
 * 플랜·한도의 유일한 수정 지점. 서버 판단, GET /v1/entitlements, Swagger·오류 문구가 모두 여기서 나온다.
 * 요금제는 무료(free)와 프리미엄(premium) 둘이고, ADMIN 주체도 premium 값을 받는다.
 */
export const PLAN_CATALOG = {
  ...PREMIUM_FEATURES,
  VOICE_NOTE: {
    kind: "quota",
    period: "month",
    meter: "VOICE_NOTE",
    free: 3,
    premium: null,
    fairUse: { premium: 100 },
    perUse: {
      maxSeconds: { free: 180, premium: 1800 },
      maxCharacters: { free: 4000, premium: 40_000 },
    },
  },
} as const satisfies Record<PlanFeature, PlanFeatureDefinition>;

type PlanFeaturesOfKind<TKind extends PlanFeatureDefinition["kind"]> = {
  [TFeature in PlanFeature]: (typeof PLAN_CATALOG)[TFeature]["kind"] extends TKind
    ? TFeature
    : never;
}[PlanFeature];

export type PlanQuotaFeatureKey = PlanFeaturesOfKind<"quota">;
export type PlanResourceFeatureKey = PlanFeaturesOfKind<"resource">;
export type PlanLimitFeatureKey = PlanQuotaFeatureKey | PlanResourceFeatureKey;
export type PlanFlagFeatureKey = PlanFeaturesOfKind<"flag">;

/** 계량기가 있는 quota 기능 */
export type MeteredFeatureKey = {
  [TFeature in PlanQuotaFeatureKey]: (typeof PLAN_CATALOG)[TFeature] extends {
    readonly meter: QuotaMeter;
  }
    ? TFeature
    : never;
}[PlanQuotaFeatureKey];

/** 출시 앱의 /me.entitlements에 있는 횟수·개수 기능 */
export type PremiumLimitFeatureKey = Extract<PlanLimitFeatureKey, PremiumFeature>;

/**
 * 보상(초대)으로 한도를 늘릴 수 있는 resource 기능. 받은 자리는 요금제 한도에 더하고 무제한 한도는 그대로다.
 * DB enum ResourceType이 이 튜플이라 값·순서를 바꾸지 않고 끝에만 더한다(마이그레이션 필요).
 */
export const GRANTABLE_FEATURE_KEYS = [
  "FRIEND",
] as const satisfies readonly PlanResourceFeatureKey[];

export type GrantableFeature = (typeof GRANTABLE_FEATURE_KEYS)[number];

/** 빠른 계획 입력이 온 경로. 말은 기기가 글자로 바꿔 보내므로 서버에 오는 것은 언제나 글자다. */
export const QUICK_PLAN_SOURCES = ["VOICE", "TEXT"] as const;
export type QuickPlanSource = (typeof QUICK_PLAN_SOURCES)[number];

/** 계획을 만든 흐름. 적용 API 하나를 함께 쓴다. */
export const ACTION_PLAN_SOURCES = ["QUICK_VOICE", "QUICK_TEXT", "VOICE_NOTE", "MEMO"] as const;
export type ActionPlanSource = (typeof ACTION_PLAN_SOURCES)[number];

export const PLANNED_ACTION_TYPES = ["CREATE_TODO", "CREATE_MEMO"] as const;
export type PlannedActionType = (typeof PLANNED_ACTION_TYPES)[number];

/** AI_1315 details.reason */
export const ACTION_PLAN_REJECTION_REASONS = ["CATEGORY_NOT_OWNED"] as const;
export type ActionPlanRejectionReason = (typeof ACTION_PLAN_REJECTION_REASONS)[number];

/** QuotaCharge·PlanApplication 키 열 길이와 같다. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/** 행동 key는 앱이 선택·편집 상태를 묶는 값이다. */
export const PLANNED_ACTION_KEY_MAX_LENGTH = 64;

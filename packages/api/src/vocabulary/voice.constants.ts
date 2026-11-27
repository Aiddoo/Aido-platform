/** 빠른 계획 입력이 온 경로. 말은 기기가 글자로 바꿔 보내므로 서버에 오는 것은 언제나 글자다. */
export const QUICK_PLAN_SOURCES = ["VOICE", "TEXT"] as const;
export type QuickPlanSource = (typeof QUICK_PLAN_SOURCES)[number];

/** 계획을 만든 흐름. 적용 API 하나를 함께 쓴다. */
export const ACTION_PLAN_SOURCES = ["QUICK_VOICE", "QUICK_TEXT", "VOICE_NOTE", "MEMO"] as const;
export type ActionPlanSource = (typeof ACTION_PLAN_SOURCES)[number];

export const PLANNED_ACTION_TYPES = ["CREATE_TODO", "CREATE_MEMO"] as const;

/** AI_1315 details.reason */
export const ACTION_PLAN_REJECTION_REASONS = ["CATEGORY_NOT_OWNED"] as const;

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * 앱이 말로 메모를 기기에 두는 기간. 적용 요청(Idempotency-Key)도 메모와 함께 남아 이 기간 안에 다시 보낼 수 있어,
 * 서버는 계획 적용 기록을 같은 기간 남겨 재시도가 할 일을 두 번 만들지 않게 한다.
 */
export const VOICE_NOTE_RETENTION_DAYS = 30;

/** QuotaCharge·PlanApplication 키 열 길이와 같다. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/** 행동 key는 앱이 선택·편집 상태를 묶는 값이다. */
export const PLANNED_ACTION_KEY_MAX_LENGTH = 64;

/** 앱이 기기 음성 인식을 맡기는 언어. 서버에는 오지 않고 앱의 인식기 포트와 말로 메모 모델이 함께 쓴다. */
export const SPEECH_LOCALES = ["ko-KR", "en-US"] as const;

/** 기기 음성 인식기가 내는 오류 코드. 인식기 포트와 빠른 말하기 실패 이유가 같은 목록을 쓴다. */
export const SPEECH_ERROR_CODES = [
  "aborted",
  "audio-capture",
  "interrupted",
  "bad-grammar",
  "language-not-supported",
  "network",
  "no-speech",
  "not-allowed",
  "service-not-allowed",
  "busy",
  "client",
  "speech-timeout",
  "too-many-requests",
  "unknown",
] as const;

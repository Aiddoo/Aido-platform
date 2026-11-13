export const AI_PARSE_LIMITS = {
  /** parse-todo 입력 최대 길이. 요청 검증과 프롬프트 입력이 같은 값을 쓴다. */
  TODO_TEXT_MAX_LENGTH: 500,
  /** parse-memo가 만드는 할 일 최대 수. 넘친 수는 meta.omittedTodoCount로 알린다. */
  MEMO_MAX_TODOS: 5,
  /** parse-memo 할 일 하나의 서브투두 최대 수 */
  MEMO_MAX_ITEMS: 5,
} as const;

/**
 * 말·글로 만드는 실행 계획(빠른 계획·녹음 정리) 상한. 요청 검증·프롬프트·정규화가 같은 값을 쓴다.
 * 할 일 하위 항목·제목·메모 길이는 손으로 만든 할 일·메모와 같은 상한(TODO_ITEM_LIMITS·MEMO_LIMITS)을 쓴다.
 */
export const ACTION_PLAN_LIMITS = {
  /** 빠른 계획 입력 최대 길이 */
  QUICK_PLAN_TEXT_MAX_LENGTH: 1000,
  /** 계획 하나의 할 일 최대 수 */
  MAX_TODOS: 10,
  /** 계획 하나의 메모 최대 수 */
  MAX_MEMOS: 1,
  /** 계획의 할 일·하위 할 일·메모 제목 최대 길이 */
  ACTION_TITLE_MAX_LENGTH: 200,
  /** 녹음 정리에 보내는 문장(segments) 최대 수 */
  DIGEST_MAX_SEGMENTS: 600,
  /** 녹음 정리 핵심 포인트 최대 수 */
  DIGEST_MAX_KEY_POINTS: 5,
  /** 녹음 정리 제목 최대 길이 */
  DIGEST_TITLE_MAX_LENGTH: 100,
  /** 녹음 정리 요약 최대 길이 */
  DIGEST_SUMMARY_MAX_LENGTH: 1000,
  /** 핵심 포인트 하나의 최대 길이 */
  DIGEST_KEY_POINT_MAX_LENGTH: 200,
} as const;

export const AI_SUGGESTION_LIMITS = {
  /** 분석을 실행하기 위한 최소 투두 수 */
  MIN_OCCURRENCES: 3,
  /** 단순 반복(같은 제목) 패턴 인정 최소 매치 수 */
  MIN_REPEAT_OCCURRENCES: 2,
  /** matchedTitles가 빈 배열인 유형(시즌/밸런스)의 최대 허용 개수 */
  NO_MATCH_TYPE_CAP: 2,
  /** 2회 반복 패턴에 요구되는 최소 신뢰도 */
  CONFIDENCE_GATE_LOW_OCC: 0.75,
  /** 3회 이상 반복 패턴에 요구되는 최소 신뢰도 */
  CONFIDENCE_GATE_MULTI_OCC: 0.6,
  ANALYSIS_WEEKS: 2,
  /** 분석에 읽는 최근 할 일 상한. 입력 토큰과 응답 잘림을 막는다. */
  MAX_ANALYSIS_TODOS: 300,
  CONTEXT_WEEKS: 4,
  MAX_SUGGESTIONS_PER_USER: 5,
  SUGGESTION_EXPIRY_DAYS: 14,
  DEFAULT_RECURRING_WEEKS: 4,
} as const;

export const AI_REPORT_TYPES = ["WEEKLY", "MONTHLY"] as const;

/** 추천에 대한 사용자 응답. 앱 분석 이벤트도 같은 값을 쓴다. */
export const SUGGESTION_ACTIONS = ["accept", "dismiss"] as const;
export type SuggestionActionKind = (typeof SUGGESTION_ACTIONS)[number];

export const AI_SUGGESTION_STATUSES = ["PENDING", "ACCEPTED", "DISMISSED"] as const;

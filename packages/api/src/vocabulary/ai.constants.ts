export const AI_PARSE_LIMITS = {
  /** 무료 사용자 월간 AI 파싱 제한 (KST 기준 매월 1일 00:00 리셋) */
  FREE_MONTHLY_LIMIT: 5,
  /** parse-todo 입력 최대 길이. 요청 검증과 프롬프트 입력이 같은 값을 쓴다. */
  TODO_TEXT_MAX_LENGTH: 500,
  /** parse-memo가 만드는 할 일 최대 수. 넘친 수는 meta.omittedTodoCount로 알린다. */
  MEMO_MAX_TODOS: 5,
  /** parse-memo 할 일 하나의 서브투두 최대 수 */
  MEMO_MAX_ITEMS: 5,
} as const;

export const SUBSCRIPTION_AI_PARSE_LIMITS = {
  FREE: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
  ACTIVE: null, // 무제한
  EXPIRED: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
  CANCELLED: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
} as const;

// TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤 사용하지 않는 AI_REPORT_LIMITS를 제거한다
/**
 * @deprecated 어디에서도 쓰지 않고 실제 디스패치(매시, 사용자 로컬 월요일·1일)와도 다르다.
 * 외부 소비 확인 뒤 제거한다.
 */
export const AI_REPORT_LIMITS = {
  WEEKLY_CRON_HOUR_UTC: 22,
  WEEKLY_CRON_DAY: 0,
  MONTHLY_CRON_HOUR_UTC: 22,
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

export const AI_PARSE_LIMITS = {
  /** 무료 사용자 월간 AI 파싱 제한 (KST 기준 매월 1일 00:00 리셋) */
  FREE_MONTHLY_LIMIT: 5,
} as const;

export const SUBSCRIPTION_AI_PARSE_LIMITS = {
  FREE: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
  ACTIVE: null, // 무제한
  EXPIRED: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
  CANCELLED: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
} as const;

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
  /** 1차 결과가 이 미만이면 다양성 재시도 */
  RETRY_THRESHOLD: 3,
  /** 재시도 호출 시 temperature */
  RETRY_TEMPERATURE: 0.5,
  ANALYSIS_WEEKS: 2,
  CONTEXT_WEEKS: 4,
  MAX_SUGGESTIONS_PER_USER: 5,
  SUGGESTION_EXPIRY_DAYS: 14,
  DEFAULT_RECURRING_WEEKS: 4,
} as const;

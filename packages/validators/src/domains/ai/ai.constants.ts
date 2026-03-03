export const AI_PARSE_LIMITS = {
  FREE_DAILY_LIMIT: 5,
} as const;

export const SUBSCRIPTION_AI_PARSE_LIMITS = {
  FREE: AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
  ACTIVE: null, // 무제한
  EXPIRED: AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
  CANCELLED: AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
} as const;

export const AI_REPORT_LIMITS = {
  /** 리포트 목록 조회 시 기본 개수 */
  DEFAULT_LIST_SIZE: 12,
  /** AI 팁 최대 개수 */
  MAX_TIPS: 5,
} as const;

export const AI_SUGGESTION_LIMITS = {
  /** 한 번에 생성 가능한 최대 제안 수 */
  MAX_SUGGESTIONS_PER_BATCH: 5,
  /** 제안 만료 기간 (일) */
  EXPIRATION_DAYS: 7,
  /** 최소 신뢰도 임계값 */
  MIN_CONFIDENCE: 0.6,
} as const;

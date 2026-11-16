import { AI_SUGGESTION_LIMITS } from '@aido/api/vocabulary';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';

export const SUGGESTION_ANALYSIS_POLL_INTERVAL_MS = 3_000;

/** 서버가 제안을 찾으려고 읽는 최근 기간이다. 서버 SUGGESTION_ANALYSIS_PERIOD_DAYS와 같은 식이다 */
export const SUGGESTION_ANALYSIS_PERIOD_DAYS = AI_SUGGESTION_LIMITS.ANALYSIS_WEEKS * DAYS_PER_WEEK;

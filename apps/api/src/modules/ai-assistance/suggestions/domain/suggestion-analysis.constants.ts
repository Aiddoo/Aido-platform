export const SUGGESTION_ANALYSIS_RUN_STATUSES = ["QUEUED", "RUNNING", "FINISHED"] as const;
export type SuggestionAnalysisRunStatus = (typeof SUGGESTION_ANALYSIS_RUN_STATUSES)[number];

export const SUGGESTION_ANALYSIS_TRIGGERS = ["SCHEDULED", "ON_DEMAND"] as const;
export type SuggestionAnalysisTrigger = (typeof SUGGESTION_ANALYSIS_TRIGGERS)[number];

export const SUGGESTION_ANALYSIS_OUTCOMES = [
  "SUGGESTIONS_CREATED",
  "NO_RECENT_TODOS",
  "NO_PATTERN_FOUND",
  "CONSENT_MISSING",
  "NOT_PREMIUM",
  "AI_UNAVAILABLE",
  "SPEND_LIMIT_REACHED",
  "FAILED",
] as const;
export type SuggestionAnalysisOutcome = (typeof SUGGESTION_ANALYSIS_OUTCOMES)[number];

// 이보다 오래 끝나지 않은 실행은 job이 사라진 것으로 보고 분석 중으로 보이지 않는다
export const RUN_STALE_AFTER_MINUTES = 60;

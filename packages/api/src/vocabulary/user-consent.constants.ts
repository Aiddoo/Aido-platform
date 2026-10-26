export const TERMS_VERSION = {
  CURRENT: "1.0.0",
} as const;

export const CONSENT_TYPE = {
  TERMS: "TERMS",
  PRIVACY: "PRIVACY",
  MARKETING: "MARKETING",
  AI_DATA_SHARING: "AI_DATA_SHARING",
} as const;

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE];

/**
 * 입력한 할 일·메모 텍스트와 리포트 통계를 Google Gemini로 보내 처리하는 데 대한 동의.
 *
 * 안내 문구가 바뀌면 VERSION을 올린다. 이전 버전에 동의한 사용자는 새 안내에 다시 동의해야 한다.
 * MIN_APP_VERSION 이상 앱만 동의 화면이 있으므로 그보다 오래된 앱의 요청은 동의 없이도 처리한다.
 */
export const AI_DATA_SHARING_CONSENT = {
  VERSION: "2026-10-26",
  MIN_APP_VERSION: "1.13.0",
} as const;

/** AI 데이터 처리 동의 상태. UNDECIDED는 아직 안내에 답하지 않은 상태다. */
export const AI_DATA_SHARING_DECISIONS = ["AGREED", "DECLINED", "UNDECIDED"] as const;

export type AiDataSharingDecision = (typeof AI_DATA_SHARING_DECISIONS)[number];

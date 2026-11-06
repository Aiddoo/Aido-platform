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
 * AI 데이터 처리 동의 안내 버전. 버전마다 글자를 보내는 AI 처리 업체가 다르다.
 * - 2026-10-26: 할 일·메모 글자와 리포트 통계를 Google Gemini로 보낸다(1.13·1.14 앱).
 * - 2026-11-04: 글자(말을 글자로 바꾼 내용 포함)만 Anthropic Claude·Google Gemini·OpenAI로 보낸다.
 *   녹음 파일은 서버로 보내지 않는다(1.15 앱).
 *
 * 이전 버전 동의도 그 버전의 처리 업체 범위에서 계속 유효하므로 출시 앱 사용자에게 다시 묻지 않는다.
 * 안내 문구가 바뀌면 이 목록 끝에 새 버전을 더하고 VERSION을 올린다.
 */
export const AI_DATA_SHARING_CONSENT_VERSIONS = ["2026-10-26", "2026-11-04"] as const;

export type AiDataSharingConsentVersion = (typeof AI_DATA_SHARING_CONSENT_VERSIONS)[number];

/** 글자를 보내 생성하는 AI 처리 업체. 시도 순서는 서버 설정 AI_PROVIDER_ORDER가 정한다. */
export const AI_PROVIDER_IDS = ["anthropic", "google", "openai"] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/** 안내 버전마다 사용자에게 고지한 AI 처리 업체. 동의 시트와 서버 라우팅이 같은 표를 쓴다. */
export const AI_DATA_SHARING_CONSENT_PROVIDERS = {
  "2026-10-26": ["google"],
  "2026-11-04": ["anthropic", "google", "openai"],
} as const satisfies Record<AiDataSharingConsentVersion, readonly AiProviderId[]>;

/**
 * VERSION은 지금 앱이 보여 주는 안내 버전이다.
 * MIN_APP_VERSION 이상 앱만 동의 화면이 있으므로 그보다 오래된 앱의 요청은 동의 없이도 처리한다.
 */
export const AI_DATA_SHARING_CONSENT = {
  VERSION: "2026-11-04",
  MIN_APP_VERSION: "1.13.0",
} as const satisfies {
  readonly VERSION: AiDataSharingConsentVersion;
  readonly MIN_APP_VERSION: string;
};

/** AI 데이터 처리 동의 상태. UNDECIDED는 아직 안내에 답하지 않은 상태다. */
export const AI_DATA_SHARING_DECISIONS = ["AGREED", "DECLINED", "UNDECIDED"] as const;

export type AiDataSharingDecision = (typeof AI_DATA_SHARING_DECISIONS)[number];

/** AI_DATA_SHARING_DECISIONS의 값을 이름으로 가리킨다. 문자열을 직접 비교하지 않도록 쓴다. */
export const AI_DATA_SHARING_DECISION = {
  AGREED: "AGREED",
  DECLINED: "DECLINED",
  UNDECIDED: "UNDECIDED",
} as const satisfies Record<AiDataSharingDecision, AiDataSharingDecision>;

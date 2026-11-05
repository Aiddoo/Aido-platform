/** Sentry tag 키와 고정 값의 단일 원본. 하드코딩 문자열 대신 이 상수를 쓴다. */
export const SENTRY_TAG = {
  FEATURE: "feature",
  HTTP_METHOD: "http.method",
  HTTP_URL: "http.url",
  HTTP_STATUS_CODE: "http.status_code",
  ERROR_CODE: "error.code",
  REQUEST_ID: "request_id",
  ALERT_KEY: "alert.key",
} as const;

export const SENTRY_EXTRA = {
  ERROR_RESPONSE: "errorResponse",
} as const;

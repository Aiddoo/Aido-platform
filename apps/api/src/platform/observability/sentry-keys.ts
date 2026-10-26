/** Sentry tag 키와 고정 값의 단일 원본. 하드코딩 문자열 대신 이 상수를 쓴다. */
export const SENTRY_TAG = {
  DOMAIN: "domain",
  FEATURE: "feature",
  HTTP_METHOD: "http.method",
  HTTP_URL: "http.url",
  HTTP_STATUS_CODE: "http.status_code",
  ERROR_CODE: "error.code",
  WEBHOOK_EVENT_TYPE: "webhook.event_type",
  WEBHOOK_STORE: "webhook.store",
} as const;

export const SENTRY_DOMAIN = {
  PAYMENT: "payment",
} as const;

export const SENTRY_FEATURE = {
  INVITE: "invite",
} as const;

export const SENTRY_EXTRA = {
  INVITE_GRANT_ID: "invite.grant_id",
  INVITE_REDEMPTION_ID: "invite.redemption_id",
  INVITE_REWARD_TYPE: "invite.reward_type",
  INVITE_ATTEMPTS: "invite.attempts",
  ERROR_RESPONSE: "errorResponse",
  WEBHOOK_APP_USER_ID: "webhook.app_user_id",
  WEBHOOK_PRODUCT_ID: "webhook.product_id",
  WEBHOOK_EVENT_ID: "webhook.event_id",
} as const;

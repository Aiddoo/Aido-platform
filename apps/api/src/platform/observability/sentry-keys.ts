/** Sentry tag 키와 고정 값의 단일 원본. 하드코딩 문자열 대신 이 상수를 쓴다. */
export const SENTRY_TAG = {
  FEATURE: "feature",
  HTTP_METHOD: "http.method",
  /** 경로 템플릿(`/v1/todos/:id`). id가 든 실제 URL은 싣지 않는다 */
  HTTP_ROUTE: "http.route",
  HTTP_STATUS_CODE: "http.status_code",
  ERROR_CODE: "error.code",
  REQUEST_ID: "request_id",
  APP_VERSION: "app_version",
  /** 이벤트 자체의 platform 필드(node)와 헷갈리지 않게 앱 접두사를 붙인다 */
  PLATFORM: "app_platform",
  ALERT_KEY: "alert_key",
  ALERT_CONTEXT: "alert_context",
  ALERT_SUBJECT: "alert_subject",
  SEVERITY: "severity",
  JOB_QUEUE: "job.queue",
  JOB_NAME: "job.name",
  JOB_ID: "job.id",
  JOB_ATTEMPT: "job.attempt",
} as const;

export const SENTRY_EXTRA = {
  ERROR_RESPONSE: "errorResponse",
  RUNBOOK: "runbook",
} as const;

export const SENTRY_TAGS = {
  FEATURE: 'feature',
  ERROR_CODE: 'errorCode',
  SERVER_ERROR_CODE: 'serverErrorCode',
  METHOD: 'method',
  ENDPOINT: 'endpoint',
  STATUS_CODE: 'statusCode',
  SOURCE: 'source',
  /** 서버 Sentry의 `request_id` 태그와 같은 값 */
  REQUEST_ID: 'request_id',
} as const;

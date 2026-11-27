import { type ErrorCodeType, Errors } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

interface ApiErrorOverrides {
  message?: string;
  status?: number;
  details?: Record<string, unknown> | null;
  requestId?: string;
  retryAfterMs?: number | null;
}

/** 문구·상태를 주지 않으면 서버 카탈로그가 그 코드에 붙이는 값이다 */
export function createApiError(
  code: ErrorCodeType,
  {
    message = Errors[code].message,
    status = Errors[code].httpStatus,
    details = null,
    ...options
  }: ApiErrorOverrides = {},
): ApiError {
  return new ApiError(code, message, status, details, options);
}

import type { ErrorCodeType } from '@aido/api/errors';

import type { CodedError } from './result';

/** 서버 비즈니스 에러(4xx). `code`는 `@aido/api/errors`의 비즈니스 에러 코드다 */
export class ApiError extends Error implements CodedError {
  override readonly name = 'ApiError';

  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  /** 타입 세이프 에러 코드 체크 - ErrorCode 상수 사용 권장 */
  hasCode<C extends ErrorCodeType>(code: C): this is ApiError & { code: C } {
    return this.code === code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

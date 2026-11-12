import type { ErrorCodeType } from '@aido/api/errors';

import { AppError, type AppErrorOptions } from './app-error';
import type { CodedError } from './result';

/** 서버가 코드로 거절한 4xx. `KyHttpClient`가 실패 봉투를 읽어 만든다 */
export class ApiError extends AppError implements CodedError {
  override readonly name = 'ApiError';
  /** 앱이 모르는 코드는 `SYS_0001`이다. 문구는 그래도 서버 message를 먼저 쓴다 */
  readonly code: ErrorCodeType;
  readonly status: number;
  /** 운영에는 `PUBLIC_ERROR_DETAILS`에 등록한 코드만 실린다. `*.error.ts`가 공유 스키마로 읽는다 */
  readonly details: Record<string, unknown> | null;

  constructor(
    code: ErrorCodeType,
    message: string,
    status: number,
    details: Record<string, unknown> | null = null,
    options?: AppErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  hasCode = <C extends ErrorCodeType>(code: C): this is ApiError & { code: C } =>
    this.code === code;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

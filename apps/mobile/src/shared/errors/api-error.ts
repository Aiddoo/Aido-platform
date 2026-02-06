import type { ErrorCodeType } from '@aido/errors';
import type { BusinessError } from './result';

/**
 * 서버 비즈니스 에러 (4xx)
 * - code: @aido/errors의 비즈니스 에러 코드
 * - status: HTTP 상태 코드
 * - details: 서버가 제공하는 추가 정보
 */
export class ApiError extends Error implements BusinessError {
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

  /** 도메인 prefix 체크 (VERIFY_, FOLLOW_ 등) */
  isDomain(prefix: string): boolean {
    return this.code.startsWith(prefix);
  }
}

/** ApiError 타입 가드 */
export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

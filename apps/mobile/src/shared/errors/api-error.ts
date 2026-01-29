/**
 * 서버 API 에러
 * - 서버에서 반환하는 에러 응답 (4xx, 5xx)
 * - code: 서버 에러 코드 (AUTH_0101, TODO_0801 등)
 * - status: HTTP 상태 코드
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }

  /** 특정 에러 코드인지 확인 */
  hasCode(code: string): boolean {
    return this.code === code;
  }

  /** 특정 도메인 에러인지 확인 (prefix 기반) */
  isDomain(prefix: string): boolean {
    return this.code.startsWith(prefix);
  }
}

/** ApiError 타입 가드 */
export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

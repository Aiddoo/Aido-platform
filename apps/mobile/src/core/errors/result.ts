/**
 * Result 타입 (객체 기반)
 * - 성공: { ok: true, value: T }
 * - 실패: { ok: false, error: E }
 *
 * 4xx 에러는 Result.err로 반환하여 UI에서 처리
 * 5xx/네트워크/타임아웃은 throw InfraError로 ErrorBoundary 처리
 */

export interface CodedError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type Result<T, E extends CodedError = CodedError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** 성공 Result 생성 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** 실패 Result 생성 */
export function err<E extends CodedError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Result를 unwrap하여 성공 시 데이터 반환, 실패 시 throw
 * - React Query mutationFn에서 사용
 * - 에러는 onError 콜백에서 처리
 */
export function unwrap<T, E extends CodedError>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * 코드를 가진 오류(서버 ApiError, 도메인 BusinessError)인지 확인한다.
 * 코드를 함께 넘기면 그 코드인 오류만 걸러낸다.
 */
export function isBusinessError(error: unknown): error is CodedError;
export function isBusinessError<TCode extends string>(
  error: unknown,
  code: TCode,
): error is CodedError & { readonly code: TCode };
export function isBusinessError(error: unknown, code?: string): error is CodedError {
  if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') {
    return false;
  }

  return code == null || error.code === code;
}

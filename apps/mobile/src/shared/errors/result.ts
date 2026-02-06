/**
 * Result 타입 (객체 기반)
 * - 성공: { ok: true, value: T }
 * - 실패: { ok: false, error: E }
 *
 * 4xx 에러는 Result.err로 반환하여 UI에서 처리
 * 5xx/네트워크/타임아웃은 throw InfraError로 ErrorBoundary 처리
 */

export interface BusinessError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type Result<T, E extends BusinessError = BusinessError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** 성공 Result 생성 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** 실패 Result 생성 */
export const err = <E extends BusinessError>(error: E): Result<never, E> => ({ ok: false, error });

/** Result가 성공인지 확인 (타입 가드) */
export const isOk = <T, E extends BusinessError>(
  result: Result<T, E>,
): result is { ok: true; value: T } => result.ok === true;

/** Result가 실패인지 확인 (타입 가드) */
export const isErr = <T, E extends BusinessError>(
  result: Result<T, E>,
): result is { ok: false; error: E } => result.ok === false;

/**
 * Result를 unwrap하여 성공 시 데이터 반환, 실패 시 throw
 * - React Query mutationFn에서 사용
 * - 에러는 onError 콜백에서 처리
 */
export const unwrap = <T, E extends BusinessError>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw result.error;
};

/**
 * BusinessError 타입 가드
 * - code와 message를 가진 Error 객체인지 확인
 */
export const isBusinessError = (error: unknown): error is BusinessError =>
  error instanceof Error && 'code' in error && typeof (error as BusinessError).code === 'string';

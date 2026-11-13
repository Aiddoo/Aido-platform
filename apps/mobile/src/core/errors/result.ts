/** 4xx 에러는 Result.err로 반환해 UI에서 처리하고, 5xx/네트워크/타임아웃은 throw해 ErrorBoundary가 처리한다 */

export interface CodedError {
  readonly code: string;
  readonly message: string;
}

export type Result<T, E extends CodedError = CodedError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends CodedError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function unwrap<T, E extends CodedError>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

export function isCodedError(error: unknown): error is CodedError;
export function isCodedError<TCode extends string>(
  error: unknown,
  code: TCode,
): error is CodedError & { readonly code: TCode };
export function isCodedError(error: unknown, code?: string): error is CodedError {
  if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') {
    return false;
  }

  return code == null || error.code === code;
}

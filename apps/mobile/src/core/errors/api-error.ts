import type { ErrorCodeType } from '@aido/api/errors';

import type { CodedError } from './result';

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

  hasCode<C extends ErrorCodeType>(code: C): this is ApiError & { code: C } {
    return this.code === code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

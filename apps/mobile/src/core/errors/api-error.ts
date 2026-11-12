import type { ErrorCodeType } from '@aido/api/errors';

import type { CodedError } from './result';

export class ApiError extends Error implements CodedError {
  override readonly name = 'ApiError';
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
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

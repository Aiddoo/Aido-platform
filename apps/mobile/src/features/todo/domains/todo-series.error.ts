import type { BusinessError } from '@src/shared/errors/result';

const TODO_SERIES_UNAVAILABLE_CODE = 'TODO_SERIES_UNAVAILABLE';

export class TodoSeriesUnavailableError extends Error implements BusinessError {
  override readonly name = 'TodoSeriesUnavailableError';
  readonly code = TODO_SERIES_UNAVAILABLE_CODE;

  constructor() {
    super('The server does not support this repeat operation yet');
  }
}

export const isTodoSeriesUnavailableError = (error: unknown): error is TodoSeriesUnavailableError =>
  error instanceof TodoSeriesUnavailableError;

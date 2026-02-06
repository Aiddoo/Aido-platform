import type { BusinessError } from '@src/shared/errors';

export const TodoErrorCode = {
  VALIDATION_FAILED: 'TODO_VALIDATION_FAILED',
} as const;

export type TodoErrorCode = (typeof TodoErrorCode)[keyof typeof TodoErrorCode];

export class TodoError extends Error implements BusinessError {
  override readonly name = 'TodoError';

  constructor(
    public readonly code: TodoErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const TodoErrors = {
  validationFailed: () =>
    new TodoError(TodoErrorCode.VALIDATION_FAILED, '응답 형식이 올바르지 않아요'),
} as const;

export const isTodoError = (error: unknown): error is TodoError => error instanceof TodoError;

import type { BusinessError } from '@src/shared/errors';

export const TodoCategoryErrorCode = {
  VALIDATION_FAILED: 'TODO_CATEGORY_VALIDATION_FAILED',
} as const;

export type TodoCategoryErrorCode =
  (typeof TodoCategoryErrorCode)[keyof typeof TodoCategoryErrorCode];

export class TodoCategoryError extends Error implements BusinessError {
  override readonly name = 'TodoCategoryError';

  constructor(
    public readonly code: TodoCategoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const TodoCategoryErrors = {
  validationFailed: () =>
    new TodoCategoryError(TodoCategoryErrorCode.VALIDATION_FAILED, '다시 시도해 주세요'),
} as const;

export const isTodoCategoryError = (error: unknown): error is TodoCategoryError =>
  error instanceof TodoCategoryError;

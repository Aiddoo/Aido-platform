import type { BusinessError } from '@src/shared/errors';

export const TodoNudgeErrorCode = {
  MESSAGE_TOO_LONG: 'TODO_NUDGE_MESSAGE_TOO_LONG',
} as const;

export type TodoNudgeErrorCode = (typeof TodoNudgeErrorCode)[keyof typeof TodoNudgeErrorCode];

export class TodoNudgeError extends Error implements BusinessError {
  override readonly name = 'TodoNudgeError';

  constructor(
    public readonly code: TodoNudgeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const TodoNudgeErrors = {
  messageTooLong: (maxLength: number) =>
    new TodoNudgeError(
      TodoNudgeErrorCode.MESSAGE_TOO_LONG,
      `메시지는 ${maxLength}자 이내로 입력할 수 있어요`,
      { maxLength },
    ),
} as const;

export const isTodoNudgeError = (error: unknown): error is TodoNudgeError =>
  error instanceof TodoNudgeError;

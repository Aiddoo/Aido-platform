export const TODO_NUDGE_ERROR_CODE = {
  MESSAGE_TOO_LONG: 'TODO_NUDGE_MESSAGE_TOO_LONG',
} as const;

export type TodoNudgeErrorCode = (typeof TODO_NUDGE_ERROR_CODE)[keyof typeof TODO_NUDGE_ERROR_CODE];

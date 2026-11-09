import { ErrorCode } from '@aido/api/errors';
import { type ApiError, isApiError } from '@src/shared/errors';

export const TODO_NUDGE_ERROR_CODE = {
  MESSAGE_TOO_LONG: 'TODO_NUDGE_MESSAGE_TOO_LONG',
} as const;

export type TodoNudgeErrorCode = (typeof TODO_NUDGE_ERROR_CODE)[keyof typeof TODO_NUDGE_ERROR_CODE];

/** 지워졌거나 볼 수 없는 콕이다. 다시 시도해도 같다 */
export function isNudgeUnavailableError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 404;
}

/** 감사 인사를 보내기 전에 콕이나 할 일이 바뀌었다(사라짐, 상태 변경) */
export function isNudgeThanksChangedError(error: unknown): error is ApiError {
  return (
    isNudgeUnavailableError(error) ||
    (isApiError(error) &&
      (error.hasCode(ErrorCode.NUDGE_1109) || error.hasCode(ErrorCode.NUDGE_1110)))
  );
}

/** 서버 플래그로 보낸 콕 목록이 꺼져 있다(NUDGE_1105) */
export function isSentNudgeListDisabledError(error: unknown): error is ApiError {
  return isApiError(error) && error.hasCode(ErrorCode.NUDGE_1105);
}

/** 콕을 보낸 뒤 할 일이 바뀌어 받는 사람 상태가 달라졌다(NUDGE_1110) */
export function isNudgeTodoChangedError(error: unknown): error is ApiError {
  return isApiError(error) && error.hasCode(ErrorCode.NUDGE_1110);
}

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

/** 서버 플래그로 보낸 콕 목록이 꺼져 있다(NUDGE_1105) */
export function isSentNudgeListDisabledError(error: unknown): error is ApiError {
  return isApiError(error) && error.hasCode(ErrorCode.NUDGE_1105);
}

/** 서버에서 그 할 일이 아직 완료 전이다(NUDGE_1110). 다른 기기에서 완료를 풀었거나 완료 저장보다 먼저 닿은 요청이다 */
export function isThanksTodoNotCompletedError(error: unknown): error is ApiError {
  return isApiError(error) && error.hasCode(ErrorCode.NUDGE_1110);
}

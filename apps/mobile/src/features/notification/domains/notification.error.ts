import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { isApiError, isConnectivityError } from '@src/shared/errors';

import type { TodoReminderActionOutcome } from './push-notification-response.model';

/** 읽음 처리가 없는 알림(NOTIFICATION_1004)·남의 알림(NOTIFICATION_1005)으로 막히면 이 기기 계정의 알림이 아니다 */
export function isForeignNotificationError(error: unknown) {
  return (
    isApiError(error) &&
    (error.hasCode(ErrorCode.NOTIFICATION_1004) || error.hasCode(ErrorCode.NOTIFICATION_1005))
  );
}

/** 기기 등록·해제를 너무 자주 보내 잠시 막혔다(코드 없는 throttler 429). 다음에 다시 보낸다 */
export function isPushRequestThrottledError(error: unknown) {
  return isApiError(error) && error.status === HttpStatus.TOO_MANY_REQUESTS;
}

/** 서버가 거절했거나 연결이 끊긴 기기 보고 실패. 다음 동기화 때 다시 보내므로 경고로만 남긴다 */
export function isPushReportRetryableError(error: unknown) {
  return isApiError(error) || isConnectivityError(error);
}

/** 다시 알림을 걸려는 할 일을 이미 끝냈다(NOTIFICATION_1007). 오류가 아니라 부드럽게 알린다 */
export function isTodoAlreadyCompletedError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.NOTIFICATION_1007);
}

/** 리마인드 알림 버튼이 실패한 까닭. 이미 끝낸 할 일과 지웠거나 남의 할 일(TODO_0801)을 나눠 센다 */
export function getTodoReminderActionFailure(
  error: unknown,
): Exclude<TodoReminderActionOutcome, 'succeeded'> {
  if (isTodoAlreadyCompletedError(error)) {
    return 'already_completed';
  }
  if (isApiError(error) && error.hasCode(ErrorCode.TODO_0801)) {
    return 'not_found';
  }
  return 'failed';
}

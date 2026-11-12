import { HttpStatus } from '@aido/api/errors';
import { isApiError, isConnectivityError } from '@src/shared/errors';

/** 읽음 처리가 403·404로 막히면 이 기기 계정의 알림이 아니다 */
export function isForeignNotificationError(error: unknown) {
  return (
    isApiError(error) &&
    (error.status === HttpStatus.FORBIDDEN || error.status === HttpStatus.NOT_FOUND)
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

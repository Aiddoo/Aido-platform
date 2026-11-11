import { isApiError, isConnectivityError } from '@src/shared/errors';

// oxlint-disable-next-line aido/http-status-literal -- 1.15.2 전환 #1400
const FORBIDDEN_STATUS = 403;
// oxlint-disable-next-line aido/http-status-literal -- 1.15.2 전환 #1400
const NOT_FOUND_STATUS = 404;

/** 읽음 처리가 403·404로 막히면 이 기기 계정의 알림이 아니다 */
export function isForeignNotificationError(error: unknown) {
  return (
    isApiError(error) && (error.status === FORBIDDEN_STATUS || error.status === NOT_FOUND_STATUS)
  );
}

/** 서버가 거절했거나 연결이 끊긴 기기 보고 실패. 다음 동기화 때 다시 보내므로 경고로만 남긴다 */
export function isPushReportRetryableError(error: unknown) {
  return isApiError(error) || isConnectivityError(error);
}

import type { ApiError } from '@src/shared/errors';

/** 읽음 처리가 403·404로 막히면 이 기기 계정의 알림이 아니다 */
export function isForeignNotificationError(error: ApiError) {
  return error.status === 403 || error.status === 404;
}

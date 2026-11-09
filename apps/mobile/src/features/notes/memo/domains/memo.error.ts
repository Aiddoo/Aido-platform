import { isApiError } from '@src/shared/errors';

const MEMO_NOT_FOUND_STATUS = 404;

/** 이미 지워진 메모를 열었을 때. 다시 시도해도 소용없다 */
export function isMemoUnavailableError(error: unknown) {
  return isApiError(error) && error.status === MEMO_NOT_FOUND_STATUS;
}

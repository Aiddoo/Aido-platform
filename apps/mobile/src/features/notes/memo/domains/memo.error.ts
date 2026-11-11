import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 지워졌거나 볼 수 없는 메모를 열었을 때(서버는 둘 다 MEMO_2001). 다시 시도해도 소용없다 */
export function isMemoUnavailableError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.MEMO_2001);
}

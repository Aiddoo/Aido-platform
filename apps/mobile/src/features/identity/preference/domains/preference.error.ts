import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 프리미엄이 아닌데 프리미엄 전용 리마인드 시각으로 바꾸려 했다 */
export function isPremiumReminderTimeError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.PREFERENCE_1701);
}

export function isInvalidTimeRangeError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.PREFERENCE_1702);
}

import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

export function isPremiumReminderTimeError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.PREFERENCE_1701);
}

export function isInvalidTimeRangeError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.PREFERENCE_1702);
}

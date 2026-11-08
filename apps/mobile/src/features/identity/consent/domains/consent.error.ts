import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 1.13.0 이상 앱이 동의 없이 AI를 요청한 AI_1311이다. 오류로 알리지 않고 동의 안내를 띄운다 */
export function isAiDataSharingConsentRequiredError(error: unknown): boolean {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1311);
}

import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 동의 없이 AI를 요청하면 AI_1311을 받는다. 오류로 알리지 않고 동의 안내를 띄운다 */
export function isAiDataSharingConsentRequiredError(error: unknown): boolean {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1311);
}

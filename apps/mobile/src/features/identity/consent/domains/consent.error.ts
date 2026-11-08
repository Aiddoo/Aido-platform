import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

export function isAiDataSharingConsentRequiredError(error: unknown): boolean {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1311);
}

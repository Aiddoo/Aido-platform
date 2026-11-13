import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 지워졌거나 내 것이 아닌 리포트(AI_1304)는 다시 시도해도 같다 */
export function isReportUnavailableError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1304);
}

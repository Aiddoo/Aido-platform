import { ErrorCode } from '@aido/api/errors';
import { type ApiError, isApiError } from '@src/shared/errors';

const TARGET_UNAVAILABLE_CODES: readonly string[] = [
  ErrorCode.REPORT_2251,
  ErrorCode.REPORT_2252,
  ErrorCode.REPORT_2253,
];

/** 신고할 대상이 사라졌거나 이미 처리돼 다시 시도해도 같다. 이때는 시트를 닫는다 */
export function isReportTargetUnavailableError(error: unknown): error is ApiError {
  return isApiError(error) && TARGET_UNAVAILABLE_CODES.includes(error.code);
}

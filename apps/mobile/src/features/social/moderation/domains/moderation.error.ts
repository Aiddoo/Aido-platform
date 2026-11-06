import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

/** 신고가 실패했을 때 시트가 할 일. 대상이 사라졌으면 다시 시도할 수 없어 시트를 닫는다 */
export type ReportFailureAction = 'close' | 'stay';

export function toReportFailureAction(error: unknown): ReportFailureAction {
  if (!isApiError(error)) {
    return 'stay';
  }

  return match(error.code)
    .with(
      P.union(ErrorCode.REPORT_2252, ErrorCode.REPORT_2253, ErrorCode.REPORT_2251),
      () => 'close' as const,
    )
    .otherwise(() => 'stay' as const);
}

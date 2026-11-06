import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import type { ReportType } from '../domains/report.model';
import { reportListParamsSchema } from '../schemas/report-params.schema';

/** 리포트 목록의 주간·월간 탭 */
export function useReportTypeParam() {
  const [{ type }, setParams] = useRouteParams(reportListParamsSchema);
  const setType = useCallback((next: ReportType) => setParams({ type: next }), [setParams]);

  return [type, setType] as const;
}

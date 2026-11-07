import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { reportListParamsSchema } from '../schemas/report-params.schema';
import { reportTypeSchema } from '../schemas/report.schema';

/** 리포트 목록의 주간·월간 탭 */
export function useReportTypeParam() {
  const [{ type }, setParams] = useRouteParams(reportListParamsSchema);
  const setType = useCallback(
    (value: string) => {
      const parsed = reportTypeSchema.safeParse(value);
      if (parsed.success) {
        setParams({ type: parsed.data });
      }
    },
    [setParams],
  );

  return [type, setType] as const;
}

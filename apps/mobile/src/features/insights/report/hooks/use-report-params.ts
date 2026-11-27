import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useView } from '@src/shared/hooks/use-view';

import { reportListTypeSchema, reportParamsSchema } from '../schemas/report-params.schema';

export function useReportId() {
  const [{ reportId }] = useRouteParams(reportParamsSchema);

  return [reportId] as const;
}

export function useReportType() {
  return useView('type', reportListTypeSchema);
}

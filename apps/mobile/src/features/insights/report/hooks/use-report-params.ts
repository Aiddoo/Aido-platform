import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { reportParamsSchema } from '../schemas/report-params.schema';

/** 리포트 상세 주소의 리포트 id. 상세 화면과 리포트 영수증이 같은 값을 읽는다 */
export function useReportId() {
  const [{ reportId }] = useRouteParams(reportParamsSchema);

  return [reportId] as const;
}

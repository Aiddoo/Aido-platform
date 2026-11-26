import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useView } from '@src/shared/hooks/use-view';

import { reportListTypeSchema, reportParamsSchema } from '../schemas/report-params.schema';

/** 리포트 상세 주소의 리포트 id. 상세 화면과 리포트 영수증이 같은 값을 읽는다 */
export function useReportId() {
  const [{ reportId }] = useRouteParams(reportParamsSchema);

  return [reportId] as const;
}

/** 리포트 목록의 주간·월간 탭. 화면과 목록이 같은 키를 읽는다 */
export function useReportType() {
  return useView('type', reportListTypeSchema);
}

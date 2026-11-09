import { useView } from '@src/shared/hooks/use-view';

import { reportListTypeSchema } from '../schemas/report-params.schema';

/** 리포트 목록의 주간·월간 탭. 화면과 목록이 같은 키를 읽는다 */
export function useReportType() {
  return useView('type', reportListTypeSchema);
}

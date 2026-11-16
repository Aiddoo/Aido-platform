import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrackView } from '@src/shared/analytics';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';

import { useGetReportDetailQueryOptions } from '../queries/report.queries';
import { reportParamsSchema } from '../schemas/report-params.schema';
import { ActivityReport } from './activity-report';

export function SavedActivityReport() {
  const [{ reportId: reportRoute }] = useRouteParams(reportParamsSchema);

  if (reportRoute.kind !== 'saved') {
    return null;
  }

  return <SavedActivityReport.Report id={reportRoute.id} />;
}

SavedActivityReport.Report = function Report({ id }: { id: number }) {
  // 시간대 차트 라벨이 시간 표기 설정을 읽으므로 리포트를 기다리는 동안 함께 받는다
  usePrefetchQuery(useGetPreferenceQueryOptions());
  const { data: report } = useSuspenseQuery(useGetReportDetailQueryOptions({ reportId: id }));

  useTrackView('ai_report_viewed', {
    key: String(id),
    params: { report_id: id, report_type: report.type },
  });

  return <ActivityReport report={report} />;
};

import { useTrack } from '@src/shared/analytics';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

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
  const { data: report } = useSuspenseQuery(useGetReportDetailQueryOptions({ reportId: id }));
  const { trackEvent } = useTrack();

  useEffect(() => {
    trackEvent('ai_report_viewed', { report_id: id, report_type: report.type });
  }, [trackEvent, id, report.type]);

  return <ActivityReport report={report} />;
};

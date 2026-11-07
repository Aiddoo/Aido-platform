import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, Text, VStack } from '@src/shared/ui';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { REPORT_TYPE_LABEL_KEYS } from '../constants/report-labels';
import { getSampleReport, SAMPLE_REPORT_IDS } from '../constants/sample-reports';
import { useReportType } from '../hooks/use-report-type';
import {
  useGetReportsQueryOptions,
  useGetReportStatusQueryOptions,
} from '../queries/report.queries';
import { ReportRow } from './report-row';

export function FreeReportPreview() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportRow report={sampleReport} isSample isLast />
      </Box>

      <Button size="medium" onPress={() => push('/settings/subscription')}>
        {t('report.list.subscribeCta')}
      </Button>
    </VStack>
  );
}

export function ReportList() {
  const [reportType] = useReportType();
  usePrefetchQuery(useGetReportStatusQueryOptions());
  const { data: reports } = useSuspenseQuery(useGetReportsQueryOptions({ type: reportType }));

  if (reports.length === 0) {
    return <PremiumPendingPreview />;
  }

  return (
    <VStack gap={4}>
      {reports.map((report, index) => (
        <ReportRow key={report.id} report={report} isLast={index === reports.length - 1} />
      ))}
    </VStack>
  );
}

function PremiumPendingPreview() {
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);
  const daysUntil = match(reportType)
    .with('WEEKLY', () => status.daysUntilWeekly)
    .with('MONTHLY', () => status.daysUntilMonthly)
    .exhaustive();
  const reportLabel = t(REPORT_TYPE_LABEL_KEYS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportRow report={sampleReport} isSample isLast />
      </Box>

      <Text size="b3" shade={7} align="center">
        {daysUntil === 0
          ? t('report.list.arrivalToday', { type: reportLabel })
          : t('report.list.arrivalInDays', { count: daysUntil, type: reportLabel })}
      </Text>
    </VStack>
  );
}

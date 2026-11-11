import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, DashedDivider, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';

import { REPORT_TYPE_LABEL_KEYS } from '../constants/report-labels';
import { getSampleReport, SAMPLE_REPORT_IDS } from '../constants/sample-reports.constants';
import { ReportStatusPolicy } from '../domains/report.model';
import { useReportType } from '../hooks/use-report-type';
import {
  useGetReportsQueryOptions,
  useGetReportStatusQueryOptions,
} from '../queries/report.queries';
import { ReportRow } from './report-row';

const LOADING_CARD_COUNT = 3;
const LOADING_STAT_COUNT = 3;

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

ReportList.Free = function Free() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportRow report={sampleReport} isSample isLast />
      </Box>

      <Button
        size="medium"
        onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_REPORT' } })}
      >
        {t('report.list.subscribeCta')}
      </Button>
    </VStack>
  );
};

function PremiumPendingPreview() {
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);
  const daysUntil = ReportStatusPolicy.getDaysUntilReport(status, reportType);
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

ReportList.Loading = function Loading() {
  return (
    <VStack>
      {range(LOADING_CARD_COUNT).map((i) => (
        <Box key={i} className="py-3">
          <VStack gap={10}>
            <HStack justify="between" align="center">
              <Skeleton className="h-6 w-12 rounded-full" />
              <VStack align="end">
                <TextSkeleton size="b4" className="w-24" />
                <TextSkeleton size="e1" className="w-20" />
              </VStack>
            </HStack>
            <HStack gap={20}>
              {range(LOADING_STAT_COUNT).map((statIndex) => (
                <VStack key={statIndex} gap={2} align="center">
                  <TextSkeleton size="e1" className="w-12" />
                  <TextSkeleton size="b2" className="w-16" />
                </VStack>
              ))}
            </HStack>
            <TextSkeleton size="b4" className="w-full" />
            <Box className="items-end">
              <TextSkeleton size="e1" className="w-16" />
            </Box>
          </VStack>
          {i < LOADING_CARD_COUNT - 1 && <DashedDivider className="mt-3" />}
        </Box>
      ))}
    </VStack>
  );
};

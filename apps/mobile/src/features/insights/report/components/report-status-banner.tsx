import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';

import { useGetReportStatusQueryOptions } from '../queries/report.queries';

export function ReportStatusBanner() {
  const { t } = useTranslation('ai');
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());

  const formatDday = (days: number) =>
    days === 0 ? t('report.dday.today') : t('report.dday.inDays', { count: days });

  return (
    <Box className="rounded-2xl border border-dashed border-gray-3 bg-white px-2 py-3">
      <HStack className="items-stretch">
        <DdayCell
          label={t('report.statusBanner.nextWeekly')}
          dday={formatDday(status.daysUntilWeekly)}
        />
        <Separator orientation="vertical" className="bg-gray-5" />
        <DdayCell
          label={t('report.statusBanner.nextMonthly')}
          dday={formatDday(status.daysUntilMonthly)}
        />
      </HStack>
    </Box>
  );
}

ReportStatusBanner.Loading = function Loading() {
  return (
    <Box className="rounded-2xl border border-dashed border-gray-3 bg-white px-2 py-3">
      <HStack className="items-stretch">
        <DdayCell.Loading />
        <Separator orientation="vertical" className="bg-gray-5" />
        <DdayCell.Loading />
      </HStack>
    </Box>
  );
};

ReportStatusBanner.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <Box className="rounded-2xl border border-dashed border-gray-3 bg-white px-4 py-3">
      <QueryErrorFallback.Inline message={t('errorBoundary.title')} reset={reset} />
    </Box>
  );
};

/** 다음 리포트까지 남은 날 한 칸 */
function DdayCell({ label, dday }: { label: string; dday: string }) {
  return (
    <VStack gap={4} align="center" className="flex-1">
      <Text size="b4" shade={6}>
        {label}
      </Text>
      <Text size="t3" weight="bold" tone="brand">
        {dday}
      </Text>
    </VStack>
  );
}

DdayCell.Loading = function Loading() {
  return (
    <VStack gap={4} align="center" className="flex-1">
      <TextSkeleton size="b4" className="w-24" />
      <TextSkeleton size="t3" className="w-12" />
    </VStack>
  );
};

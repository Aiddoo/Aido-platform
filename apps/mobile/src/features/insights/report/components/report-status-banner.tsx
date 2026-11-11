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
        <VStack gap={4} align="center" className="flex-1">
          <Text size="b4" shade={6}>
            {t('report.statusBanner.nextWeekly')}
          </Text>

          <Text size="t3" weight="bold" tone="brand">
            {formatDday(status.daysUntilWeekly)}
          </Text>
        </VStack>
        <Separator orientation="vertical" className="bg-gray-5" />
        <VStack gap={4} align="center" className="flex-1">
          <Text size="b4" shade={6}>
            {t('report.statusBanner.nextMonthly')}
          </Text>

          <Text size="t3" weight="bold" tone="brand">
            {formatDday(status.daysUntilMonthly)}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}

ReportStatusBanner.Loading = function Loading() {
  return (
    <Box className="rounded-2xl border border-dashed border-gray-3 bg-white px-2 py-3">
      <HStack className="items-stretch">
        <VStack gap={4} align="center" className="flex-1">
          <TextSkeleton size="b4" className="w-24" />
          <TextSkeleton size="t3" className="w-12" />
        </VStack>

        <Separator orientation="vertical" className="bg-gray-5" />

        <VStack gap={4} align="center" className="flex-1">
          <TextSkeleton size="b4" className="w-24" />
          <TextSkeleton size="t3" className="w-12" />
        </VStack>
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

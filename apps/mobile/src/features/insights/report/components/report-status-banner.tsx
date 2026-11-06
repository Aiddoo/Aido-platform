import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton, VStack, Box } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';

import { useGetReportStatusQueryOptions } from '../queries/get-report-status-query-options';
import { formatDday } from '../utils/format-report';

export function ReportStatusBanner() {
  const { t } = useTranslation('ai');
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());

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

        <Separator orientation="vertical" className="bg-gray-3" />

        <VStack gap={4} align="center" className="flex-1">
          <TextSkeleton size="b4" className="w-24" />
          <TextSkeleton size="t3" className="w-12" />
        </VStack>
      </HStack>
    </Box>
  );
};

import { HStack, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator, SkeletonGroup } from 'heroui-native';
import { View } from 'react-native';
import { useGetReportStatusQueryOptions } from '../queries/use-get-report-status-query-options';
import { formatDday } from '../utils/format-report';

export function ReportStatusBanner() {
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());

  return (
    <View className="rounded-2xl border border-dashed border-gray-3 bg-gray-1 px-2 py-3">
      <HStack className="items-stretch">
        <VStack gap={4} align="center" className="flex-1">
          <Text size="b4" shade={6}>
            다음 주간 리포트
          </Text>

          <Text size="t3" weight="bold" tone="brand">
            {formatDday(status.daysUntilWeekly)}
          </Text>
        </VStack>
        <Separator orientation="vertical" className="bg-gray-5" />
        <VStack gap={4} align="center" className="flex-1">
          <Text size="b4" shade={6}>
            다음 월간 리포트
          </Text>

          <Text size="t3" weight="bold" tone="brand">
            {formatDday(status.daysUntilMonthly)}
          </Text>
        </VStack>
      </HStack>
    </View>
  );
}

ReportStatusBanner.Loading = function Loading() {
  return (
    <View className="rounded-2xl border border-dashed border-gray-3 bg-gray-1 px-2 py-3">
      <SkeletonGroup isLoading>
        <HStack className="items-stretch">
          <VStack gap={4} align="center" className="flex-1">
            <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
            <SkeletonGroup.Item className="h-7 w-12 rounded-md" />
          </VStack>

          <Separator orientation="vertical" className="bg-gray-3" />

          <VStack gap={4} align="center" className="flex-1">
            <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
            <SkeletonGroup.Item className="h-7 w-12 rounded-md" />
          </VStack>
        </HStack>
      </SkeletonGroup>
    </View>
  );
};

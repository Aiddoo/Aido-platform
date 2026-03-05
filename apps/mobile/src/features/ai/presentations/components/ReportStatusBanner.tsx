import { HStack } from '@src/shared/ui/HStack/HStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, Separator, SkeletonGroup } from 'heroui-native';
import { getReportStatusQueryOptions } from '../queries/get-report-status-query-options';
import { formatDday } from '../utils/format-report';

export function ReportStatusBanner() {
  const { data: status } = useSuspenseQuery(getReportStatusQueryOptions());

  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <HStack className="items-stretch">
        <VStack gap={4} align="center" className="flex-1 py-2">
          <Text size="b4" shade={6}>
            다음 주간 리포트
          </Text>

          <Text size="t3" weight="bold" tone="brand">
            {formatDday(status.daysUntilWeekly)}
          </Text>
        </VStack>
        <Separator orientation="vertical" className="bg-gray-3" />
        <VStack gap={4} align="center" className="flex-1 py-2">
          <Text size="b4" shade={6}>
            다음 월간 리포트
          </Text>

          <Text size="t3" weight="bold" tone="brand">
            {formatDday(status.daysUntilMonthly)}
          </Text>
        </VStack>
      </HStack>
    </Card>
  );
}

ReportStatusBanner.Loading = function Loading() {
  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <SkeletonGroup isLoading>
        <HStack className="items-stretch">
          <VStack gap={4} align="center" className="flex-1 py-2">
            <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
            <Spacing size={2} />
            <SkeletonGroup.Item className="h-7 w-12 rounded-md" />
          </VStack>

          <Separator orientation="vertical" className="bg-gray-3" />

          <VStack gap={4} align="center" className="flex-1 py-2">
            <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
            <Spacing size={2} />
            <SkeletonGroup.Item className="h-7 w-12 rounded-md" />
          </VStack>
        </HStack>
      </SkeletonGroup>
    </Card>
  );
};

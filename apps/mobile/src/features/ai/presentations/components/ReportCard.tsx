import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { times } from 'es-toolkit/compat';
import { type Href, useRouter } from 'expo-router';
import { Card, Chip, PressableFeedback, SkeletonGroup } from 'heroui-native';
import type { AiReport } from '../../models/ai.model';

interface ReportCardProps {
  report: AiReport;
  isSample?: boolean;
}

export function ReportCard({ report, isSample }: ReportCardProps) {
  const router = useRouter();
  const href = (
    isSample ? `/reports/sample-${report.type.toLowerCase()}` : `/reports/${report.id}`
  ) as Href;

  return (
    <PressableFeedback onPress={() => router.push(href)} className="rounded-2xl">
      <PressableFeedback.Highlight className="rounded-2xl" />
      <Card
        className={cn('border border-gray-3 dark:bg-gray-2', !report.hasActivity && 'opacity-50')}
      >
        <VStack gap={12}>
          <HStack justify="between" align="center">
            <HStack align="center" gap={6}>
              {isSample && (
                <Chip size="sm" variant="soft" color="warning">
                  <Chip.Label>예시</Chip.Label>
                </Chip>
              )}
              <Chip
                size="sm"
                variant="soft"
                color={report.type === 'WEEKLY' ? 'accent' : 'success'}
              >
                <Chip.Label>{report.type === 'WEEKLY' ? '주간' : '월간'}</Chip.Label>
              </Chip>
            </HStack>

            <Text size="b4" shade={5}>
              {report.periodLabel}
            </Text>
          </HStack>

          <HStack gap={16}>
            <StatItem label="달성률" value={`${report.stats.completionRate}%`} />
            <StatItem
              label="완료"
              value={`${report.stats.completedTodos}/${report.stats.totalTodos}`}
            />
            <StatItem label="연속" value={`${report.stats.streakDays}일`} />
          </HStack>

          {report.hasActivity && report.aiSummary && (
            <Text size="b4" shade={6} maxLines={2}>
              {report.aiSummary}
            </Text>
          )}
        </VStack>
      </Card>
    </PressableFeedback>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <VStack gap={2} align="center">
      <Text size="e1" shade={6}>
        {label}
      </Text>
      <Text size="b2" weight="bold" shade={9}>
        {value}
      </Text>
    </VStack>
  );
}

ReportCard.Loading = function Loading() {
  return (
    <VStack gap={12}>
      {times(3, (i) => (
        <Card key={i} className="border border-gray-3 dark:bg-gray-2">
          <SkeletonGroup isLoading>
            <VStack gap={12}>
              <HStack justify="between" align="center">
                <SkeletonGroup.Item className="h-6 w-12 rounded-full" />
                <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
              </HStack>
              <HStack gap={16}>
                <SkeletonGroup.Item className="h-10 w-16 rounded-md" />
                <SkeletonGroup.Item className="h-10 w-16 rounded-md" />
                <SkeletonGroup.Item className="h-10 w-16 rounded-md" />
              </HStack>
              <SkeletonGroup.Item className="h-4 w-full rounded-md" />
            </VStack>
          </SkeletonGroup>
        </Card>
      ))}
    </VStack>
  );
};

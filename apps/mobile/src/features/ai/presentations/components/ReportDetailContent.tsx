import { HStack } from '@src/shared/ui/HStack';
import { Spacing } from '@src/shared/ui/Spacing';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
import { cn } from '@src/shared/utils/cn';
import { Card, Chip, Separator, SkeletonGroup } from 'heroui-native';
import { View } from 'react-native';
import type { AiReport } from '../../models/ai.model';
import { DAY_LABELS } from '../constants/day-labels.constant';
import { formatHour } from '../utils/format-report';

interface ReportDetailContentProps {
  report: AiReport;
}

export function ReportDetailContent({ report }: ReportDetailContentProps) {
  return (
    <>
      <ReportHeader report={report} />

      <Spacing size={16} />

      <StatsOverview report={report} />

      <Spacing size={16} />

      {report.categoryBreakdown.length > 0 && (
        <>
          <CategoryBreakdown items={report.categoryBreakdown} />
          <Spacing size={16} />
        </>
      )}

      {report.dayPatterns.length > 0 && (
        <>
          <DayPatternChart items={report.dayPatterns} />
          <Spacing size={16} />
        </>
      )}

      {report.timePatterns.length > 0 && (
        <>
          <TimePatternSummary items={report.timePatterns} />
          <Spacing size={16} />
        </>
      )}

      {report.aiSummary && (
        <>
          <AiSummarySection summary={report.aiSummary} />
          <Spacing size={16} />
        </>
      )}

      {report.aiTips.length > 0 && (
        <>
          <AiTipsSection tips={report.aiTips} />
          <Spacing size={32} />
        </>
      )}
    </>
  );
}

function ReportHeader({ report }: { report: AiReport }) {
  return (
    <HStack align="center" gap={8}>
      <Chip size="sm" variant="soft" color={report.type === 'WEEKLY' ? 'accent' : 'success'}>
        <Chip.Label>{report.type === 'WEEKLY' ? '주간' : '월간'}</Chip.Label>
      </Chip>

      <Text size="b2" weight="semibold" shade={9}>
        {report.periodLabel}
      </Text>

      <Text size="b4" shade={5}>
        {report.dateRange.startDate} ~ {report.dateRange.endDate}
      </Text>
    </HStack>
  );
}

function StatsOverview({ report }: { report: AiReport }) {
  const { stats } = report;
  const rateDiff =
    stats.prevCompletionRate !== null ? stats.completionRate - stats.prevCompletionRate : null;

  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={16}>
        <Text size="b3" weight="bold" shade={9}>
          통계 요약
        </Text>

        <HStack justify="around">
          <VStack align="center" gap={4}>
            <Text size="e1" shade={6}>
              달성률
            </Text>
            <Text size="t2" weight="bold" tone="brand">
              {stats.completionRate}%
            </Text>
            {rateDiff !== null && (
              <Text size="e2" tone={rateDiff >= 0 ? 'success' : 'danger'}>
                {rateDiff >= 0 ? '+' : ''}
                {rateDiff}%
              </Text>
            )}
          </VStack>

          <VStack align="center" gap={4}>
            <Text size="e1" shade={6}>
              완료
            </Text>

            <Text size="t2" weight="bold" shade={9}>
              {stats.completedTodos}
            </Text>

            <Text size="e2" shade={6}>
              / {stats.totalTodos}
            </Text>
          </VStack>
          <VStack align="center" gap={4}>
            <Text size="e1" shade={6}>
              연속
            </Text>

            <Text size="t2" weight="bold" shade={9}>
              {stats.streakDays}일
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Card>
  );
}

function CategoryBreakdown({ items }: { items: AiReport['categoryBreakdown'] }) {
  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={12}>
        <Text size="b3" weight="bold" shade={9}>
          카테고리별 분석
        </Text>
        {items.map((item) => (
          <VStack key={item.name} gap={4}>
            <HStack justify="between" align="center">
              <HStack align="center" gap={6}>
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <Text size="b4" shade={8}>
                  {item.name}
                </Text>
              </HStack>
              <Text size="b4" shade={6}>
                {item.completed}/{item.total} ({item.rate}%)
              </Text>
            </HStack>
            <View className="h-2 bg-gray-3 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{ width: `${item.rate}%`, backgroundColor: item.color }}
              />
            </View>
          </VStack>
        ))}
      </VStack>
    </Card>
  );
}

function DayPatternChart({ items }: { items: AiReport['dayPatterns'] }) {
  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={12}>
        <Text size="b3" weight="bold" shade={9}>
          요일별 패턴
        </Text>
        <HStack justify="around">
          {items.map((item) => (
            <VStack key={item.day} align="center" gap={4}>
              <Text size="e2" shade={6}>
                {DAY_LABELS[item.day] ?? item.day}
              </Text>
              <View
                className={cn(
                  'w-8 h-8 rounded-full items-center justify-center',
                  item.rate >= 80 ? 'bg-main/20' : item.rate >= 50 ? 'bg-main/10' : 'bg-gray-3',
                )}
              >
                <Text size="e2" weight="bold" shade={item.rate >= 50 ? 9 : 5}>
                  {item.rate}
                </Text>
              </View>
            </VStack>
          ))}
        </HStack>
      </VStack>
    </Card>
  );
}

function TimePatternSummary({ items }: { items: AiReport['timePatterns'] }) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const top3 = sorted.slice(0, 3);

  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={12}>
        <Text size="b3" weight="bold" shade={9}>
          활발한 시간대
        </Text>
        {top3.map((item, index) => (
          <HStack key={item.hour} align="center" gap={8}>
            <Text size="b4" weight="bold" tone="brand">
              {index + 1}
            </Text>

            <Separator orientation="vertical" className="h-3 bg-gray-3" />

            <Text size="b4" shade={8}>
              {formatHour(item.hour)}
            </Text>

            <Text size="b4" shade={6}>
              {item.count}건
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

function AiSummarySection({ summary }: { summary: string }) {
  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={8}>
        <Text size="b3" weight="bold" shade={9}>
          AI 요약
        </Text>
        <Text size="b4" shade={7} className="leading-5">
          {summary}
        </Text>
      </VStack>
    </Card>
  );
}

function AiTipsSection({ tips }: { tips: string[] }) {
  return (
    <Card className="border border-gray-3 dark:bg-gray-2">
      <VStack gap={8}>
        <Text size="b3" weight="bold" shade={9}>
          AI 팁
        </Text>

        {tips.map((tip, index) => (
          <HStack key={`${index}-${tip.slice(0, 10)}`} gap={8} className="items-start">
            <Text size="b4" weight="bold" tone="brand">
              {index + 1}.
            </Text>

            <Text size="b4" shade={7} className="flex-1 leading-5">
              {tip}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

ReportDetailContent.Loading = function Loading() {
  return (
    <VStack className="px-4" gap={16}>
      <Spacing size={16} />
      <SkeletonGroup isLoading>
        <SkeletonGroup.Item className="h-8 w-48 rounded-md" />
        <SkeletonGroup.Item className="h-32 w-full rounded-2xl" />
        <SkeletonGroup.Item className="h-40 w-full rounded-2xl" />
        <SkeletonGroup.Item className="h-24 w-full rounded-2xl" />
        <SkeletonGroup.Item className="h-24 w-full rounded-2xl" />
      </SkeletonGroup>
    </VStack>
  );
};

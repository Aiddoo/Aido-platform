import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  DashedDivider,
  HStack,
  ScallopedContainer,
  Spacing,
  Text,
  VStack,
  Box,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { getDateFormatContext, getDayOfWeekLabel } from '@src/shared/utils/date';
import { formatDateKeyRange, formatHourLabel } from '@src/shared/utils/date-format';
import { formatPercent } from '@src/shared/utils/format';
import type { TimeFormat } from '@src/shared/utils/time';
import { useSuspenseQuery } from '@tanstack/react-query';
import { orderBy } from 'es-toolkit';
import { Chip, Separator, SkeletonGroup } from 'heroui-native';

import { REPORT_TYPE_CHIP_COLORS, REPORT_TYPE_LABEL_KEYS } from '../constants/report-type';
import type { AiReport } from '../domains/ai.model';

interface ActivityReportProps {
  report: AiReport;
}

export function ActivityReport({ report }: ActivityReportProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  return (
    <ScallopedContainer>
      <Box className="px-5 pt-4 pb-2">
        <ReportPeriodLabel report={report} />
      </Box>
      <VStack className="px-5 pb-4">
        <VStack>
          <Box className="py-4">
            <TodoCompletionStats report={report} />
          </Box>
        </VStack>
        {report.categoryBreakdown.length > 0 && (
          <VStack>
            <DashedDivider />
            <Box className="py-4">
              <CategoryBreakdown items={report.categoryBreakdown} />
            </Box>
          </VStack>
        )}
        {report.dayPatterns.length > 0 && (
          <VStack>
            <DashedDivider />
            <Box className="py-4">
              <DayPatternChart items={report.dayPatterns} />
            </Box>
          </VStack>
        )}
        {report.timePatterns.length > 0 && (
          <VStack>
            <DashedDivider />
            <Box className="py-4">
              <TimePatternSummary items={report.timePatterns} timeFormat={preference.timeFormat} />
            </Box>
          </VStack>
        )}
        {report.aiSummary && (
          <VStack>
            <DashedDivider />
            <Box className="py-4">
              <AiAnalysis summary={report.aiSummary} />
            </Box>
          </VStack>
        )}
        {report.aiTips.length > 0 && (
          <VStack>
            <DashedDivider />
            <Box className="py-4">
              <ImprovementTipList tips={report.aiTips} />
            </Box>
          </VStack>
        )}
      </VStack>
    </ScallopedContainer>
  );
}

function ReportPeriodLabel({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  return (
    <HStack align="center" gap={8} className="flex-wrap">
      <Chip
        size="sm"
        variant="soft"
        color={REPORT_TYPE_CHIP_COLORS[report.type]}
        className="self-center"
      >
        <Chip.Label>{t(REPORT_TYPE_LABEL_KEYS[report.type])}</Chip.Label>
      </Chip>

      <Text size="b2" weight="semibold" shade={9}>
        {report.periodLabel}
      </Text>

      <Text size="b4" shade={5}>
        {formatDateKeyRange(
          report.dateRange.startDate,
          report.dateRange.endDate,
          getDateFormatContext(),
        )}
      </Text>
    </HStack>
  );
}

function TodoCompletionStats({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  const { stats } = report;
  const rateDiff =
    stats.prevCompletionRate != null ? stats.completionRate - stats.prevCompletionRate : null;

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.statsSummary')}
      </Text>

      <HStack justify="around">
        <VStack align="center" gap={4}>
          <Text size="e1" shade={6}>
            {t('report.card.completionRate')}
          </Text>
          <Text size="t2" weight="bold" tone="brand">
            {formatPercent(stats.completionRate)}%
          </Text>
          {rateDiff != null && (
            <Text size="e2" tone={rateDiff >= 0 ? 'success' : 'danger'}>
              {rateDiff > 0 ? '+' : ''}
              {formatPercent(rateDiff)}%
            </Text>
          )}
        </VStack>

        <VStack align="center" gap={4}>
          <Text size="e1" shade={6}>
            {t('report.card.completed')}
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
            {t('report.card.streak')}
          </Text>

          <Text size="t2" weight="bold" shade={9}>
            {t('report.card.streakDays', { count: stats.streakDays })}
          </Text>
        </VStack>
      </HStack>
    </VStack>
  );
}

function CategoryBreakdown({ items }: { items: AiReport['categoryBreakdown'] }) {
  const { t } = useTranslation('ai');
  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.categoryBreakdown')}
      </Text>
      {items.map((item) => (
        <VStack key={item.name} gap={4}>
          <HStack justify="between" align="center">
            <HStack align="center" gap={6}>
              <Box className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <Text size="b4" shade={8}>
                {item.name}
              </Text>
            </HStack>
            <Text size="b4" shade={6}>
              {item.completed}/{item.total} ({item.rate}%)
            </Text>
          </HStack>
          <Box className="h-2 bg-gray-3 rounded-full overflow-hidden">
            <Box
              className="h-full rounded-full"
              style={{ width: `${item.rate}%`, backgroundColor: item.color }}
            />
          </Box>
        </VStack>
      ))}
    </VStack>
  );
}

function DayPatternChart({ items }: { items: AiReport['dayPatterns'] }) {
  const { t } = useTranslation('ai');
  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.dayPatterns')}
      </Text>
      <HStack justify="around">
        {items.map((item) => (
          <VStack key={item.day} align="center" gap={4}>
            <Text size="e2" shade={6}>
              {getDayOfWeekLabel(item.day)}
            </Text>
            <Box
              className={cn(
                'w-8 h-8 rounded-full items-center justify-center',
                item.rate >= 80 ? 'bg-main/20' : item.rate >= 50 ? 'bg-main/10' : 'bg-gray-3',
              )}
            >
              <Text size="e2" weight="bold" shade={item.rate >= 50 ? 9 : 5}>
                {item.rate}
              </Text>
            </Box>
          </VStack>
        ))}
      </HStack>
    </VStack>
  );
}

function TimePatternSummary({
  items,
  timeFormat,
}: {
  items: AiReport['timePatterns'];
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation('ai');
  const top3 = orderBy(items, ['count'], ['desc']).slice(0, 3);

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.activeHours')}
      </Text>
      {top3.map((item, index) => (
        <HStack key={item.hour} align="center" gap={8}>
          <Text size="b4" weight="bold" tone="brand">
            {index + 1}
          </Text>

          <Separator orientation="vertical" className="h-3 bg-gray-3" />

          <Text size="b4" shade={8}>
            {formatHourLabel(item.hour, timeFormat, getDateFormatContext())}
          </Text>

          <Text size="b4" shade={6}>
            {t('report.detail.countUnit', { count: item.count })}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}

function AiAnalysis({ summary }: { summary: string }) {
  const { t } = useTranslation('ai');
  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.aiSummary')}
      </Text>
      <Text size="b4" shade={7} className="leading-5">
        {summary}
      </Text>
    </VStack>
  );
}

function ImprovementTipList({ tips }: { tips: string[] }) {
  const { t } = useTranslation('ai');
  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.aiTips')}
      </Text>

      {tips.map((tip, index) => (
        <HStack key={tip} gap={8} className="items-start">
          <Text size="b4" weight="bold" tone="brand">
            {index + 1}.
          </Text>

          <Text size="b4" shade={7} className="flex-1 leading-5">
            {tip}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}

ActivityReport.Loading = function Loading() {
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

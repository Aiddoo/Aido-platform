import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatHourLabel } from '@src/shared/date/format/date-format';
import { formatDateKeyRange, getDayOfWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  DashedDivider,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  ScallopedContainer,
  Text,
  TextSkeleton,
  VStack,
  Box,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { Separator, Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

import { isReportUnavailableError } from '../domains/report.error';
import { type AiReport, ReportPolicy } from '../domains/report.model';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import { ReportTypeChip } from './report-type-chip';

const TOP_HOUR_COUNT = 3;
const LOADING_STAT_COUNT = 3;

interface ActivityReportProps {
  report: AiReport;
}

export function ActivityReport({ report }: ActivityReportProps) {
  return (
    <ScallopedContainer>
      <Box className="px-5 pt-4 pb-2">
        <ReportPeriodLabel report={report} />
      </Box>
      <VStack className="px-5 pb-4">
        <Box className="py-4">
          <TodoCompletionStats report={report} />
        </Box>
        {report.categoryBreakdown.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <CategoryBreakdown items={report.categoryBreakdown} />
            </Box>
          </>
        )}
        {report.dayPatterns.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <DayPatternChart items={report.dayPatterns} />
            </Box>
          </>
        )}
        {report.timePatterns.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <TimePatternSummary report={report} />
            </Box>
          </>
        )}
        {report.aiSummary.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <AiAnalysis summary={report.aiSummary} />
            </Box>
          </>
        )}
        {report.aiTips.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <ImprovementTipList tips={report.aiTips} />
            </Box>
          </>
        )}
      </VStack>
    </ScallopedContainer>
  );
}

function ReportPeriodLabel({ report }: { report: AiReport }) {
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  return (
    <HStack align="center" gap={8} className="flex-wrap">
      <ReportTypeChip type={report.type} className="self-center" />

      <Text size="b2" weight="semibold" shade={9}>
        {formatReportPeriodLabel(report, todayKey, dateFormatContext)}
      </Text>

      <Text size="b4" shade={5}>
        {formatDateKeyRange(
          report.dateRange.startDate,
          report.dateRange.endDate,
          todayKey,
          dateFormatContext,
        )}
      </Text>
    </HStack>
  );
}

function TodoCompletionStats({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  const { locale } = useDateFormatContext();
  const { stats } = report;
  const rateDiff = ReportPolicy.getCompletionRateChange(report);

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
            {formatPercent(stats.completionRate, locale)}
          </Text>
          {rateDiff != null && (
            <Text size="e2" tone={rateDiff >= 0 ? 'success' : 'danger'}>
              {formatPercent(rateDiff, locale, { signDisplay: 'exceptZero' })}
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
  const { locale } = useDateFormatContext();
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
              {item.completed}/{item.total} ({formatPercent(item.rate, locale)})
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
  const { t, i18n } = useTranslation('ai');
  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.dayPatterns')}
      </Text>
      <HStack justify="around">
        {items.map((item) => {
          const level = ReportPolicy.getCompletionLevel(item);

          return (
            <VStack key={item.day} align="center" gap={4}>
              <Text size="e2" shade={6}>
                {getDayOfWeekLabel(item.day, i18n.language)}
              </Text>
              <Box
                className={cn(
                  'w-8 h-8 rounded-full items-center justify-center',
                  match(level)
                    .with('high', () => 'bg-main/20')
                    .with('medium', () => 'bg-main/10')
                    .with('low', () => 'bg-gray-3')
                    .exhaustive(),
                )}
              >
                <Text size="e2" weight="bold" shade={level === 'low' ? 5 : 9}>
                  {item.rate}
                </Text>
              </Box>
            </VStack>
          );
        })}
      </HStack>
    </VStack>
  );
}

function TimePatternSummary({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const topHours = ReportPolicy.getMostActiveHours(report, TOP_HOUR_COUNT);

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.activeHours')}
      </Text>
      {topHours.map((item, index) => (
        <HStack key={item.hour} align="center" gap={8}>
          <Text size="b4" weight="bold" tone="brand">
            {index + 1}
          </Text>

          <Separator orientation="vertical" className="h-3 bg-gray-3" />

          <Text size="b4" shade={8}>
            {formatHourLabel(item.hour, preference.timeFormat, dateFormatContext)}
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
    <ScallopedContainer>
      <Box className="px-5 pt-4 pb-2">
        <HStack align="center" gap={8}>
          <Skeleton className="h-6 w-12 rounded-full" />
          <TextSkeleton size="b2" className="w-24" />
          <TextSkeleton size="b4" className="w-32" />
        </HStack>
      </Box>

      <VStack className="px-5 pb-4">
        <Box className="py-4">
          <VStack gap={16}>
            <TextSkeleton size="b3" className="w-32" />
            <HStack justify="around">
              {range(LOADING_STAT_COUNT).map((index) => (
                <VStack key={index} align="center" gap={4}>
                  <TextSkeleton size="e1" className="w-12" />
                  <TextSkeleton size="t2" className="w-16" />
                </VStack>
              ))}
            </HStack>
          </VStack>
        </Box>

        <DashedDivider />

        <Box className="py-4">
          <VStack gap={16}>
            <TextSkeleton size="b3" className="w-32" />
            <TextSkeleton size="b4" className="w-full" />
            <TextSkeleton size="b4" className="w-full" />
          </VStack>
        </Box>
      </VStack>
    </ScallopedContainer>
  );
};

/** 지워졌거나 볼 수 없는 리포트는 목록으로 보내고, 그 밖의 실패는 다시 시도를 준다. 예전 알림·딥링크가 지운 리포트를 열 때 보인다 */
ActivityReport.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('ai');

  if (!isReportUnavailableError(error)) {
    return <QueryErrorFallback reset={reset} />;
  }

  return (
    <Result
      testID="report-unavailable"
      title={t('report.unavailable.title')}
      description={t('report.unavailable.description')}
      button={
        <Result.Button onPress={() => router.dismissTo('/reports')}>
          {t('report.unavailable.backToList')}
        </Result.Button>
      }
    />
  );
};

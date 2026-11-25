import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { HOURS_PER_DAY } from '@src/shared/constants/time-units';
import { formatHourLabel, type TimeFormat } from '@src/shared/date/format/date-format';
import { formatDateKeyRange } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  DashedDivider,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  ScallopedContainer,
  Text,
  TextSkeleton,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { formatPercent } from '@src/shared/utils/number-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useState } from 'react';
import { match, P } from 'ts-pattern';

import type { ReportChart } from '../constants/report.events';
import { isReportUnavailableError } from '../domains/report.error';
import {
  type AiReport,
  type DailyCompletion,
  ReportPolicy,
  type ReportType,
} from '../domains/report.model';
import { useReportId } from '../hooks/use-report-params';
import { useGetReportDetailQueryOptions } from '../queries/report.queries';
import { formatDailyValueLine, getDailyCompletionLabels } from '../utils/report-chart.view-model';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import { CompletionHourChart } from './completion-hour-chart';
import { CompletionRateHeadline } from './completion-rate-headline';
import { DailyCompletionChart } from './daily-completion-chart';
import { ReportTypeChip } from './report-type-chip';

const LOADING_STAT_COUNT = 3;

export function ActivityReport() {
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const [reportId] = useReportId();

  // 시간대 차트 라벨이 시간 표기 설정을 읽으므로 리포트와 함께 받는다
  const [{ data: report }, { data: preference }] = useSuspenseQueries({
    queries: [useGetReportDetailQueryOptions({ reportId }), useGetPreferenceQueryOptions()],
  });
  const accountId = useMyAccountId();

  useTrackView('ai_report_viewed', {
    key: String(reportId),
    params: { report_id: reportId, report_type: report.type },
  });

  const handleFirstChartTap = (chart: ReportChart) => {
    trackEvent('ai_report_chart_tapped', { chart });
    if (accountId != null) {
      trackAttributedFeatureSuccess({ accountId, feature: 'ai_report' });
    }
  };

  return (
    <ActivityReport.Receipt
      report={report}
      timeFormat={preference.timeFormat}
      onFirstChartTap={handleFirstChartTap}
    />
  );
}

interface ActivityReportReceiptProps {
  report: AiReport;
  timeFormat: TimeFormat;
  /** 차트마다 처음 누를 때 한 번 부른다. 예시 리포트는 넘기지 않아 지표를 남기지 않는다 */
  onFirstChartTap?: (chart: ReportChart) => void;
}

/** 실제 리포트와 무료 예시가 함께 쓰는 리포트 영수증 */
ActivityReport.Receipt = function Receipt({
  report,
  timeFormat,
  onFirstChartTap,
}: ActivityReportReceiptProps) {
  const { t } = useTranslation('ai');

  const { peakHour } = report;

  return (
    <ScallopedContainer>
      <Box className="px-5 pt-4 pb-2">
        <ReportPeriodLabel report={report} />
      </Box>
      <VStack className="px-5 pb-4">
        <Box className="py-4">
          <VStack gap={16} testID="report-summary">
            <CompletionRateHeadline report={report} />

            <HStack gap={20}>
              <Stat
                label={t('report.card.completed')}
                value={`${report.stats.completedTodos}/${report.stats.totalTodos}`}
              />
              {report.stats.perfectDays != null && (
                <Stat
                  label={t('report.card.perfectDays')}
                  value={t('report.card.days', { count: report.stats.perfectDays })}
                />
              )}
              <Stat
                label={t('report.card.streak')}
                value={t('report.card.days', { count: report.stats.streakDays })}
              />
            </HStack>
          </VStack>
        </Box>
        {report.dailyCompletions != null && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <ActivityReport.DailyCompletions
                reportType={report.type}
                dailyCompletions={report.dailyCompletions}
                onFirstTap={() => onFirstChartTap?.('daily_completions')}
              />
            </Box>
          </>
        )}
        {peakHour != null && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <ActivityReport.CompletionHours
                report={report}
                peakHour={peakHour}
                timeFormat={timeFormat}
                onFirstTap={() => onFirstChartTap?.('completion_hours')}
              />
            </Box>
          </>
        )}
        {report.categoryBreakdown.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <CategoryBreakdown items={report.categoryBreakdown} />
            </Box>
          </>
        )}
        {(report.aiSummary.length > 0 || report.aiTips.length > 0) && (
          <Box className="py-4">
            <ActivityReport.Coach report={report} />
          </Box>
        )}
      </VStack>
    </ScallopedContainer>
  );
};

interface DailyCompletionsProps {
  reportType: ReportType;
  dailyCompletions: DailyCompletion[];
  onFirstTap?: () => void;
}

ActivityReport.DailyCompletions = function DailyCompletions({
  reportType,
  dailyCompletions,
  onFirstTap,
}: DailyCompletionsProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const valueLine = formatDailyValueLine(
    selectedIndex == null ? null : (dailyCompletions[selectedIndex] ?? null),
    dateFormatContext,
  );

  const handleSelectedIndexChange = (index: number) => {
    if (selectedIndex == null) {
      onFirstTap?.();
    }
    setSelectedIndex(index);
  };

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.dailyCompletions')}
      </Text>
      <VStack gap={8}>
        <DailyCompletionChart
          values={dailyCompletions}
          labels={getDailyCompletionLabels(reportType, dailyCompletions, dateFormatContext)}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={handleSelectedIndexChange}
          accessibilityLabel={t('report.detail.dailyCompletions')}
          accessibilityValue={{ text: valueLine }}
          testID="report-daily-chart"
        />
        <Text size="b4" shade={7} className="tabular-nums">
          {valueLine}
        </Text>
      </VStack>
    </VStack>
  );
};

interface CompletionHoursProps {
  report: AiReport;
  peakHour: number;
  timeFormat: TimeFormat;
  onFirstTap?: () => void;
}

ActivityReport.CompletionHours = function CompletionHours({
  report,
  peakHour,
  timeFormat,
  onFirstTap,
}: CompletionHoursProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();

  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const hourlyCounts = ReportPolicy.getHourlyCompletionCounts(report);
  const hourLabels = range(HOURS_PER_DAY).map((hour) =>
    formatHourLabel(hour, timeFormat, dateFormatContext),
  );
  const valueLine =
    selectedHour == null
      ? t('report.detail.peakHour', {
          hour: formatHourLabel(peakHour, timeFormat, dateFormatContext),
        })
      : t('report.detail.hourCompletions', {
          hour: formatHourLabel(selectedHour, timeFormat, dateFormatContext),
          count: hourlyCounts[selectedHour] ?? 0,
        });

  const handleSelectedHourChange = (hour: number) => {
    if (selectedHour == null) {
      onFirstTap?.();
    }
    setSelectedHour(hour);
  };

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.completionHours')}
      </Text>
      <VStack gap={8}>
        <CompletionHourChart
          values={hourlyCounts}
          labels={hourLabels}
          selectedIndex={selectedHour}
          onSelectedIndexChange={handleSelectedHourChange}
          accessibilityLabel={t('report.detail.completionHours')}
          accessibilityValue={{ text: valueLine }}
          testID="report-hour-chart"
        />
        <Text size="b4" shade={7} className="tabular-nums">
          {valueLine}
        </Text>
      </VStack>
    </VStack>
  );
};

ActivityReport.Coach = function Coach({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  const fontScaledSize = useFontScaledSize();

  return (
    <VStack gap={12} className="rounded-2xl bg-white p-4">
      {/* AI 없이 통계로 채운 글은 AI가 쓴 것처럼 보이지 않게 이름을 바꾼다 */}
      {match(report.aiContentSource)
        .with('TEMPLATE', () => (
          <Text size="b3" weight="semibold" shade={9}>
            {t('report.coach.templateTitle')}
          </Text>
        ))
        .with('AI', P.nullish, () => (
          <HStack align="center" gap={6}>
            <AiFilledIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-main"
            />
            <Text size="b3" weight="semibold" shade={9}>
              {t('report.coach.aiTitle')}
            </Text>
          </HStack>
        ))
        .exhaustive()}
      {/* 긴 한글 글이 Android에서 단어 중간에 끊기지 않게 단어 단위로 줄을 바꾼다 */}
      {report.aiSummary.length > 0 && (
        <WordWrapText size="b4" shade={8}>
          {report.aiSummary}
        </WordWrapText>
      )}
      {report.aiTips.map((tip, index) => (
        <HStack key={`${index}-${tip}`} gap={8} className="items-start">
          <Text size="b4" weight="bold" tone="brand">
            {index + 1}.
          </Text>
          <WordWrapText size="b4" shade={7} className="flex-1">
            {tip}
          </WordWrapText>
        </HStack>
      ))}
    </VStack>
  );
};

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
            <CompletionRateHeadline.Loading />

            <HStack gap={20}>
              {range(LOADING_STAT_COUNT).map((index) => (
                <Stat.Loading key={index} />
              ))}
            </HStack>
          </VStack>
        </Box>
        <DashedDivider />
        <Box className="py-4">
          <VStack gap={16}>
            <TextSkeleton size="b3" className="w-32" />
            <VStack gap={8}>
              <DailyCompletionChart.Loading />
              <TextSkeleton size="b4" className="w-48" />
            </VStack>
          </VStack>
        </Box>
        <DashedDivider />
        <Box className="py-4">
          <VStack gap={16}>
            <TextSkeleton size="b3" className="w-28" />
            <VStack gap={8}>
              <CompletionHourChart.Loading />
              <TextSkeleton size="b4" className="w-48" />
            </VStack>
          </VStack>
        </Box>
      </VStack>
    </ScallopedContainer>
  );
};

/** 지워졌거나 볼 수 없는 리포트는 목록으로 보내고, 그 밖의 실패는 다시 시도를 준다. 예전 알림·딥링크가 지운 리포트를 열 때 보인다 */
ActivityReport.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const router = useRouter();
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <VStack gap={2} align="center">
      <Text size="e1" shade={6}>
        {label}
      </Text>
      <Text size="b2" weight="bold" shade={9} className="tabular-nums">
        {value}
      </Text>
    </VStack>
  );
}

Stat.Loading = function Loading() {
  return (
    <VStack gap={2} align="center">
      <TextSkeleton size="e1" className="w-12" />
      <TextSkeleton size="b2" className="w-16" />
    </VStack>
  );
};

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
              <Box className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <Text size="b4" shade={8}>
                {item.name}
              </Text>
            </HStack>
            <Text size="b4" shade={6}>
              {item.completed}/{item.total} ({formatPercent(item.rate, locale)})
            </Text>
          </HStack>
          <Box className="h-2 overflow-hidden rounded-full bg-gray-3">
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

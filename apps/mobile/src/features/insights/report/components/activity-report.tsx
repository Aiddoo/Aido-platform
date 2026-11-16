import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { HOURS_PER_DAY } from '@src/shared/constants/time-units';
import {
  formatDateKeyLabel,
  formatHourLabel,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { formatDateKeyRange } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  DashedDivider,
  HStack,
  LockIcon,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  RedactedText,
  Result,
  ScallopedContainer,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { formatPercent } from '@src/shared/utils/number-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
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
import { useGetReportDetailQueryOptions } from '../queries/report.queries';
import { reportParamsSchema } from '../schemas/report-params.schema';
import {
  getDailyCompletionLabels,
  getHourlyCompletionCounts,
} from '../utils/report-chart.view-model';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import type { ReportVisibility } from '../utils/report-visibility.view-model';
import { CompletionHourChart } from './completion-hour-chart';
import { CompletionRateHeadline } from './completion-rate-headline';
import { DailyCompletionChart } from './daily-completion-chart';
import { ReportTypeChip } from './report-type-chip';

const LOADING_STAT_COUNT = 3;
/** 무료 예시에서 가림 막대 없이 보이는 카테고리 수 */
const TEASER_CATEGORY_COUNT = 1;
const LOCK_ICON_SIZE = 14;

export function ActivityReport() {
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const [{ reportId }] = useRouteParams(reportParamsSchema);

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
      // 서버가 AI_REPORT 권한을 확인하고 준 리포트라 모두 보인다
      visibility="full"
      timeFormat={preference.timeFormat}
      onFirstChartTap={handleFirstChartTap}
    />
  );
}

interface ActivityReportReceiptProps {
  report: AiReport;
  visibility: ReportVisibility;
  timeFormat: TimeFormat;
  /** 차트마다 처음 누를 때 한 번 부른다. 예시 리포트는 넘기지 않아 지표를 남기지 않는다 */
  onFirstChartTap?: (chart: ReportChart) => void;
}

/** 실제 리포트와 무료 예시가 함께 쓰는 리포트 영수증. 둘의 차이는 visibility 하나다 */
ActivityReport.Receipt = function Receipt({
  report,
  visibility,
  timeFormat,
  onFirstChartTap,
}: ActivityReportReceiptProps) {
  const { t } = useTranslation('ai');

  const peakHour = ReportPolicy.getPeakHour(report);

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
              {report.dailyCompletions != null && (
                <Stat
                  label={t('report.card.perfectDays')}
                  value={t('report.card.days', {
                    count: ReportPolicy.getPerfectDayCount(report),
                  })}
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
                visibility={visibility}
                onFirstTap={() => onFirstChartTap?.('completion_hours')}
              />
            </Box>
          </>
        )}
        {report.categoryBreakdown.length > 0 && (
          <>
            <DashedDivider />
            <Box className="py-4">
              <CategoryBreakdown items={report.categoryBreakdown} visibility={visibility} />
            </Box>
          </>
        )}
        {(report.aiSummary.length > 0 || report.aiTips.length > 0) && (
          <Box className="py-4">
            <ActivityReport.Coach report={report} visibility={visibility} />
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

  const selectedDay = selectedIndex == null ? null : dailyCompletions[selectedIndex];
  const valueLine = match(selectedDay)
    .with(P.nullish, () => t('report.detail.dailyHint'))
    .with({ total: 0 }, (day) =>
      t('report.detail.dayEmpty', {
        date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
      }),
    )
    .with(P.nonNullable, (day) =>
      t('report.detail.dayCompletions', {
        date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        completed: day.completed,
        total: day.total,
      }),
    )
    .exhaustive();

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
  visibility: ReportVisibility;
  onFirstTap?: () => void;
}

ActivityReport.CompletionHours = function CompletionHours({
  report,
  peakHour,
  timeFormat,
  visibility,
  onFirstTap,
}: CompletionHoursProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();

  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const hourlyCounts = getHourlyCompletionCounts(report);
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
  // 무료 예시는 차트 모양과 누른 칸의 수만 보이고 가장 많이 끝낸 시간이라는 해석을 가린다
  const isPeakHourHidden = visibility === 'teaser' && selectedHour == null;

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
          accessibilityValue={{
            text: isPeakHourHidden ? t('report.teaser.hiddenLabel') : valueLine,
          }}
          testID="report-hour-chart"
        />
        {isPeakHourHidden ? (
          <RedactedText
            size="b4"
            className="w-48"
            accessibilityLabel={t('report.teaser.hiddenLabel')}
          />
        ) : (
          <Text size="b4" shade={7} className="tabular-nums">
            {valueLine}
          </Text>
        )}
      </VStack>
    </VStack>
  );
};

interface CoachProps {
  report: AiReport;
  visibility: ReportVisibility;
}

ActivityReport.Coach = function Coach({ report, visibility }: CoachProps) {
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
      {match(visibility)
        .with('full', () => (
          <>
            {report.aiSummary.length > 0 && (
              <Text size="b4" shade={8} className="leading-5">
                {report.aiSummary}
              </Text>
            )}
            {report.aiTips.map((tip, index) => (
              <HStack key={tip} gap={8} className="items-start">
                <Text size="b4" weight="bold" tone="brand">
                  {index + 1}.
                </Text>
                <Text size="b4" shade={7} className="flex-1 leading-5">
                  {tip}
                </Text>
              </HStack>
            ))}
          </>
        ))
        // 첫 줄로 어떤 글인지 보이고 나머지 해석과 팁은 가린다
        .with('teaser', () => (
          <>
            {report.aiSummary.length > 0 && (
              <VStack>
                <Text size="b4" shade={8} numberOfLines={1}>
                  {report.aiSummary}
                </Text>
                <RedactedText
                  size="b4"
                  lineCount={2}
                  accessibilityLabel={t('report.teaser.hiddenLabel')}
                />
              </VStack>
            )}
            {report.aiTips.map((tip, index) => (
              <HStack key={tip} gap={8} className="items-start">
                <Text size="b4" weight="bold" tone="brand">
                  {index + 1}.
                </Text>
                <RedactedText
                  size="b4"
                  className="flex-1"
                  accessibilityLabel={t('report.teaser.hiddenLabel')}
                />
              </HStack>
            ))}
            <HStack align="center" gap={4}>
              <LockIcon
                width={fontScaledSize(LOCK_ICON_SIZE)}
                height={fontScaledSize(LOCK_ICON_SIZE)}
                colorClassName="text-gray-6"
              />
              <Text size="e1" shade={6} className="flex-1">
                {t('report.teaser.coachHint')}
              </Text>
            </HStack>
          </>
        ))
        .exhaustive()}
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

interface CategoryBreakdownProps {
  items: AiReport['categoryBreakdown'];
  visibility: ReportVisibility;
}

function CategoryBreakdown({ items, visibility }: CategoryBreakdownProps) {
  const { t } = useTranslation('ai');

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.categoryBreakdown')}
      </Text>
      {items.map((item, index) =>
        visibility === 'teaser' && TEASER_CATEGORY_COUNT <= index ? (
          <HiddenCategoryRow key={item.name} item={item} />
        ) : (
          <CategoryRow key={item.name} item={item} />
        ),
      )}
    </VStack>
  );
}

function CategoryRow({ item }: { item: AiReport['categoryBreakdown'][number] }) {
  const { locale } = useDateFormatContext();

  return (
    <VStack gap={4}>
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
      <CategoryRateBar item={item} />
    </VStack>
  );
}

/** 이름과 수는 가리고 색과 막대 모양만 남겨 카테고리가 몇 개 더 있는지 보인다 */
function HiddenCategoryRow({ item }: { item: AiReport['categoryBreakdown'][number] }) {
  const { t } = useTranslation('ai');

  return (
    <VStack gap={4} accessible accessibilityLabel={t('report.teaser.hiddenCategory')}>
      <HStack justify="between" align="center">
        <HStack align="center" gap={6}>
          <Box className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
          <RedactedText
            size="b4"
            className="w-16"
            accessibilityLabel={t('report.teaser.hiddenCategory')}
          />
        </HStack>
        <RedactedText
          size="b4"
          className="w-20"
          accessibilityLabel={t('report.teaser.hiddenCategory')}
        />
      </HStack>
      <CategoryRateBar item={item} />
    </VStack>
  );
}

function CategoryRateBar({ item }: { item: AiReport['categoryBreakdown'][number] }) {
  return (
    <Box className="h-2 overflow-hidden rounded-full bg-gray-3">
      <Box
        className="h-full rounded-full"
        style={{ width: `${item.rate}%`, backgroundColor: item.color }}
      />
    </Box>
  );
}

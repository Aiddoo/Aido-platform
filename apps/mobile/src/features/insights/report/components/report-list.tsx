import { AI_REPORT_PAGE_SIZE } from '@aido/api/vocabulary';
import { getPremiumGateAnalyticsFeature } from '@src/features/billing/subscription/utils/subscription-analytics';
import { useGetWeeklyAchievementsInfiniteQueryOptions } from '@src/features/insights/achievement/queries/achievement.queries';
import { useGetDailyCompletionsInRangeQueriesOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { getIsoWeekDateRange } from '@src/shared/date/date-key';
import { formatDateKeyRange, formatIsoWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HintPopoverContent,
  HStack,
  IconButton,
  InfoIcon,
  LabelChip,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/number-format';
import {
  usePrefetchInfiniteQuery,
  usePrefetchQuery,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { type Href, Link, useRouter } from 'expo-router';
import { Popover, PressableFeedback, Skeleton } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import { match } from 'ts-pattern';

import { SAMPLE_REPORT_COUNT } from '../constants/sample-report.constants';
import { ReportStatusPolicy } from '../domains/report-status.model';
import type { AiReport } from '../domains/report.model';
import { useReportType } from '../hooks/use-report-params';
import {
  useGetReportsQueryOptions,
  useGetReportStatusQueryOptions,
} from '../queries/report.queries';
import {
  getRecentTrendWeeks,
  getTrendIsoWeekYears,
  type TrendWeek,
} from '../utils/report-chart.view-model';
import { getReportTypeLabelKey } from '../utils/report-label.view-model';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import { createSampleReport, getSampleTrendWeeks } from '../utils/sample-report.view-model';
import { CompletionRateHeadline } from './completion-rate-headline';
import { CompletionTrendLine } from './completion-trend-line';
import { DailyCompletionChart } from './daily-completion-chart';
import { ReportTypeChip } from './report-type-chip';
import { ThisWeekRecordChart } from './this-week-record-chart';

const LOADING_CARD_COUNT = 3;
const LOADING_STAT_COUNT = 3;
/** 예시 목록 맨 위 최근 리포트 카드는 지난주·지난달이다 */
const LATEST_SAMPLE_PERIODS_AGO = 1;

interface ReportListProps {
  /** 최근 리포트 카드의 추세 칸(`RecentCompletionTrend`). 조회 경계는 화면이 감싸 넘긴다 */
  trend: ReactNode;
  /** 리포트가 아직 없을 때 보이는 이번 주 기록 칸(`ThisWeekRecord`). 조회 경계는 화면이 감싸 넘긴다 */
  thisWeekRecord: ReactNode;
}

export function ReportList({ trend, thisWeekRecord }: ReportListProps) {
  const { t } = useTranslation('ai');

  const [reportType] = useReportType();
  const todayKey = useTodayKey();
  // 프리페치가 추세가 걸친 해를 알아야 해 파생 값을 쿼리보다 먼저 둔다
  const trendYears = getTrendIsoWeekYears(todayKey);
  usePrefetchQuery(useGetReportStatusQueryOptions());
  // 최근 리포트의 추세가 목록을 받은 뒤에야 조회를 시작하지 않게 함께 건다
  usePrefetchInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: trendYears.endYear }),
  );
  usePrefetchInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: trendYears.startYear }),
  );
  const { data: reports } = useSuspenseQuery(
    useGetReportsQueryOptions({ type: reportType, limit: AI_REPORT_PAGE_SIZE.DEFAULT }),
  );

  const [latestReport, ...pastReports] = reports;

  if (latestReport == null) {
    return <ReportList.Empty thisWeekRecord={thisWeekRecord} />;
  }

  return (
    <VStack gap={20}>
      <ReportList.Latest
        report={latestReport}
        href={{ pathname: '/reports/[reportId]', params: { reportId: String(latestReport.id) } }}
        trend={trend}
      />

      {pastReports.length > 0 && (
        <VStack className="gap-1">
          <Text size="b3" weight="semibold" shade={9}>
            {t('report.list.pastReports')}
          </Text>
          {pastReports.map((report, index) => (
            <ReportList.Item
              key={report.id}
              report={report}
              href={{ pathname: '/reports/[reportId]', params: { reportId: String(report.id) } }}
              isLast={index === pastReports.length - 1}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

interface ReportListLatestProps {
  report: AiReport;
  href: Href;
  /** 최근 주별 완료율 추세. 실제 목록은 주간 성취로 그린 추세를, 예시는 예시 추세를 넘긴다 */
  trend: ReactNode;
  testID?: string;
}

ReportList.Latest = function Latest({ report, href, trend, testID }: ReportListLatestProps) {
  const { t } = useTranslation('ai');
  const router = useRouter();
  // Item과 같은 이유로 Link와 같은 navigate를 쓴다
  const navigate = useSingleTap(router.navigate);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        {/* 카드를 한 접근성 요소로 묶으면 안의 추세 차트에서 주를 고를 수 없다. 스크린리더는 [자세히 보기]로 연다 */}
        <PressableFeedback className="rounded-2xl" accessible={false} testID={testID}>
          <PressableFeedback.Highlight className="rounded-2xl" />
          <VStack className="gap-4 rounded-2xl bg-white p-4">
            <HStack align="center" gap={8} className="flex-wrap">
              <ReportTypeChip type={report.type} pointerEvents="none" />

              <Text size="b2" weight="semibold" shade={9}>
                {formatReportPeriodLabel(report, todayKey, dateFormatContext)}
              </Text>

              <Text size="b4" shade={5} className="tabular-nums">
                {formatDateKeyRange(
                  report.dateRange.startDate,
                  report.dateRange.endDate,
                  todayKey,
                  dateFormatContext,
                )}
              </Text>
            </HStack>

            <CompletionRateHeadline report={report} />

            {trend}

            <Box className="items-end">
              <TextButton size="small" variant="arrow" onPress={() => navigate(href)}>
                {t('report.card.viewDetail')}
              </TextButton>
            </Box>
          </VStack>
        </PressableFeedback>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction icon="doc.text" onPress={() => navigate(href)}>
          {t('report.card.viewDetail')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
};

interface ReportListItemProps {
  report: AiReport;
  href: Href;
  isLast?: boolean;
}

ReportList.Item = function Item({ report, href, isLast = false }: ReportListItemProps) {
  const { t } = useTranslation('ai');
  const router = useRouter();
  // Link가 navigate로 열어 같은 상세는 한 번만 쌓인다. 안쪽 버튼·메뉴도 같은 동사여야 겹쳐 쌓이지 않는다
  const navigate = useSingleTap(router.navigate);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <PressableFeedback className="rounded-xl">
          <PressableFeedback.Highlight className="rounded-xl" />
          <Box className={cn('py-3', !report.hasActivity && 'opacity-50')}>
            <VStack gap={10}>
              <HStack justify="between" align="center">
                <HStack align="center" gap={6}>
                  <ReportTypeChip type={report.type} pointerEvents="none" />
                </HStack>

                <VStack align="end">
                  <Text size="b4" shade={7}>
                    {formatReportPeriodLabel(report, todayKey, dateFormatContext)}
                  </Text>
                  <Text size="e1" shade={7} className="tabular-nums">
                    {formatDateKeyRange(
                      report.dateRange.startDate,
                      report.dateRange.endDate,
                      todayKey,
                      dateFormatContext,
                    )}
                  </Text>
                </VStack>
              </HStack>

              <HStack gap={20}>
                <Stat
                  label={t('report.card.completionRate')}
                  value={formatPercent(report.stats.completionRate, dateFormatContext.locale)}
                />
                <Stat
                  label={t('report.card.completed')}
                  value={`${report.stats.completedTodos}/${report.stats.totalTodos}`}
                />
                <Stat
                  label={t('report.card.streak')}
                  value={t('report.card.days', { count: report.stats.streakDays })}
                />
              </HStack>

              {report.hasActivity && report.aiSummary.length > 0 && (
                <Text
                  size="b4"
                  shade={7}
                  numberOfLines={2}
                  lineBreakStrategyIOS="hangul-word"
                  textBreakStrategy="highQuality"
                >
                  {report.aiSummary}
                </Text>
              )}

              <Box className="items-end">
                <TextButton size="small" variant="arrow" onPress={() => navigate(href)}>
                  {t('report.card.viewDetail')}
                </TextButton>
              </Box>
            </VStack>
          </Box>

          {!isLast && <DashedDivider />}
        </PressableFeedback>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction icon="doc.text" onPress={() => navigate(href)}>
          {t('report.card.viewDetail')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
};

ReportList.Free = function Free({ thisWeekRecord }: { thisWeekRecord: ReactNode }) {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const router = useRouter();
  const { language } = useLocaleContext();
  const [reportType] = useReportType();
  const todayKey = useTodayKey();
  const gateParams = {
    feature: getPremiumGateAnalyticsFeature('AI_REPORT'),
    surface: 'report_list',
    presentation: 'inline',
  } as const;

  useTrackView('premium_gate_shown', { key: gateParams.feature, params: gateParams });

  // 결제 화면을 한 번 여는 누름은 지표도 한 번만 남긴다
  const handleSubscribePress = useSingleTap(() => {
    trackEvent('premium_gate_cta_tapped', gateParams);
    router.push({ pathname: '/paywall', params: { feature: 'AI_REPORT' } });
  });

  return (
    <VStack gap={20}>
      {thisWeekRecord}

      <DashedDivider />

      <VStack className="gap-1">
        <HStack align="center" gap={6}>
          <Text size="b3" weight="semibold" shade={9}>
            {t('report.sample.title')}
          </Text>
          <LabelChip
            color="warning"
            label={t('report.sample.badge')}
            labelProps={{ numberOfLines: 1 }}
            pointerEvents="none"
          />
        </HStack>
        <Text size="b4" shade={6}>
          {t('report.sample.listDescription')}
        </Text>
      </VStack>

      <ReportList.Latest
        report={createSampleReport(reportType, LATEST_SAMPLE_PERIODS_AGO, { todayKey, language })}
        href={{
          pathname: '/reports/sample',
          params: { type: reportType, periodsAgo: String(LATEST_SAMPLE_PERIODS_AGO) },
        }}
        trend={<CompletionTrend weeks={getSampleTrendWeeks(todayKey)} />}
        testID="report-sample-latest"
      />

      <VStack className="gap-1">
        <Text size="b3" weight="semibold" shade={9}>
          {t('report.list.pastReports')}
        </Text>
        {range(LATEST_SAMPLE_PERIODS_AGO + 1, SAMPLE_REPORT_COUNT + 1).map((periodsAgo) => (
          <ReportList.Item
            key={periodsAgo}
            report={createSampleReport(reportType, periodsAgo, { todayKey, language })}
            href={{
              pathname: '/reports/sample',
              params: { type: reportType, periodsAgo: String(periodsAgo) },
            }}
            isLast={periodsAgo === SAMPLE_REPORT_COUNT}
          />
        ))}
      </VStack>

      <Button size="medium" testID="report-free-subscribe" onPress={handleSubscribePress}>
        {t('report.list.subscribeCta')}
      </Button>
    </VStack>
  );
};

ReportList.Loading = function Loading() {
  return (
    <VStack gap={20}>
      <VStack className="gap-4 rounded-2xl bg-white p-4">
        <HStack align="center" gap={8}>
          <Skeleton className="h-6 w-12 rounded-full" />
          <TextSkeleton size="b2" className="w-24" />
          <TextSkeleton size="b4" className="w-32" />
        </HStack>
        <CompletionRateHeadline.Loading />
        <RecentCompletionTrend.Loading />
        <Box className="items-end">
          <TextSkeleton size="e1" className="w-16" />
        </Box>
      </VStack>

      <VStack className="gap-1">
        <TextSkeleton size="b3" className="w-24" />
        {range(LOADING_CARD_COUNT).map((cardIndex) => (
          <Box key={cardIndex}>
            <Box className="py-3">
              <VStack gap={10}>
                <HStack justify="between" align="center">
                  <Skeleton className="h-6 w-12 rounded-full" />
                  <VStack align="end">
                    <TextSkeleton size="b4" className="w-24" />
                    <TextSkeleton size="e1" className="w-20" />
                  </VStack>
                </HStack>
                <HStack gap={20}>
                  {range(LOADING_STAT_COUNT).map((statIndex) => (
                    <VStack key={statIndex} gap={2} align="center">
                      <TextSkeleton size="e1" className="w-12" />
                      <TextSkeleton size="b2" className="w-16" />
                    </VStack>
                  ))}
                </HStack>
                <Box className="items-end">
                  <TextSkeleton size="e1" className="w-16" />
                </Box>
              </VStack>
            </Box>

            {cardIndex < LOADING_CARD_COUNT - 1 && <DashedDivider />}
          </Box>
        ))}
      </VStack>
    </VStack>
  );
};

ReportList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

ReportList.Empty = function Empty({ thisWeekRecord }: { thisWeekRecord: ReactNode }) {
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  const { timezone } = useDateFormatContext();
  const now = useMinuteNow();
  // 상태 쿼리의 로딩·오류는 ReportStatusBanner 경계가 맡는다. 여기서 읽으면 한 오류가 두 곳에 뜬다
  const { data: status } = useQuery(useGetReportStatusQueryOptions());
  const reportLabel = t(getReportTypeLabelKey(reportType));

  return (
    <VStack gap={16}>
      {thisWeekRecord}

      {status == null ? (
        <TextSkeleton size="b3" className="mx-auto w-48" />
      ) : (
        <Text size="b3" shade={7} align="center">
          {match(ReportStatusPolicy.getDaysUntilReport(status, reportType, { now, timezone }))
            .with(0, () => t('report.list.arrivalToday', { type: reportLabel }))
            .otherwise((count) => t('report.list.arrivalInDays', { count, type: reportLabel }))}
        </Text>
      )}
    </VStack>
  );
};

export function RecentCompletionTrend() {
  const { trackEvent } = useTrack();
  const todayKey = useTodayKey();
  const { startYear, endYear } = getTrendIsoWeekYears(todayKey);

  // 두 해는 ReportList가 함께 미리 받기 시작해 차례로 읽어도 기다림이 겹치지 않는다. 같은 해면 같은 쿼리다
  const { data: endYearWeeks } = useSuspenseInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: endYear }),
  );
  const { data: startYearWeeks } = useSuspenseInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: startYear }),
  );

  const recentWeeks = getRecentTrendWeeks(
    [...endYearWeeks.items, ...startYearWeeks.items].map((week) => ({
      startDate: week.dateRange.startDate,
      completionRate: week.completionRate,
    })),
  );

  return (
    <CompletionTrend
      weeks={recentWeeks}
      onFirstTap={() => trackEvent('ai_report_chart_tapped', { chart: 'completion_trend' })}
    />
  );
}

RecentCompletionTrend.Loading = function Loading() {
  const { t } = useTranslation('ai');

  return (
    <VStack gap={8}>
      <Text size="b4" shade={6}>
        {t('report.latest.trendTitle')}
      </Text>
      <CompletionTrendLine.Loading />
    </VStack>
  );
};

RecentCompletionTrend.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return <QueryErrorFallback.Inline message={t('errorBoundary.title')} reset={reset} />;
};

interface CompletionTrendProps {
  /** 오래된 주부터 온다 */
  weeks: TrendWeek[];
  /** 처음 누를 때 한 번 부른다. 예시 추세는 넘기지 않아 지표를 남기지 않는다 */
  onFirstTap?: () => void;
}

function CompletionTrend({ weeks, onFirstTap }: CompletionTrendProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const firstWeek = weeks[0];
  const lastWeek = weeks.at(-1);

  if (firstWeek == null || lastWeek == null) {
    return <CompletionTrendLine.Empty message={t('report.latest.trendEmpty')} />;
  }

  const handleSelectedIndexChange = (index: number) => {
    if (selectedIndex == null) {
      onFirstTap?.();
    }
    setSelectedIndex(index);
  };

  return (
    <VStack gap={8}>
      <Text size="b4" shade={6}>
        {t('report.latest.trendTitle')}
      </Text>
      <CompletionTrendLine
        values={weeks.map((week) => week.completionRate)}
        labels={weeks.map((week) =>
          formatIsoWeekLabel(week.startDate, todayKey, dateFormatContext),
        )}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={handleSelectedIndexChange}
        accessibilityLabel={t('report.latest.trendLabel', {
          count: weeks.length,
          start: formatPercent(firstWeek.completionRate, dateFormatContext.locale),
          end: formatPercent(lastWeek.completionRate, dateFormatContext.locale),
        })}
      />
    </VStack>
  );
}

interface ThisWeekRecordProps {
  /** 무료는 AI 분석을 프리미엄에서, 첫 리포트 전 프리미엄은 리포트가 오면 받는다고 안내한다 */
  access: 'free' | 'premium';
}

export function ThisWeekRecord({ access }: ThisWeekRecordProps) {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const todayKey = useTodayKey();

  // Suspense라 덮는 달을 모두 받은 뒤에 그린다
  const completionsByDate = useSuspenseQueries(
    useGetDailyCompletionsInRangeQueriesOptions(getIsoWeekDateRange(todayKey)),
  );

  return (
    <VStack gap={16} testID="report-this-week-record">
      <HStack align="center" gap={4}>
        <Text size="b3" weight="semibold" shade={9}>
          {t('report.thisWeek.title')}
        </Text>
        <ThisWeekRecord.GuideTooltip
          description={match(access)
            .with('free', () => t('report.thisWeek.info.free'))
            .with('premium', () => t('report.thisWeek.info.premium'))
            .exhaustive()}
        />
      </HStack>
      <ThisWeekRecordChart
        completionsByDate={completionsByDate ?? {}}
        todayKey={todayKey}
        accessibilityLabel={t('report.thisWeek.title')}
        // 리포트 없이 할 일 기록만 그린 차트라 리포트 차트와 다른 값으로 세고 AI 리포트 사용으로 치지 않는다
        onFirstTap={() => trackEvent('ai_report_chart_tapped', { chart: 'this_week_record' })}
      />
    </VStack>
  );
}

ThisWeekRecord.GuideTooltip = function GuideTooltip({ description }: { description: string }) {
  const { t } = useTranslation('ai');
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);

  // 말풍선은 앱 루트에 그려져 알림·링크로 화면을 떠나도 남으므로 떠날 때 닫는다
  useOnScreenBlur(() => setIsOpen(false));

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <IconButton
          accessibilityLabel={t('report.thisWeek.info.label')}
          icon={
            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-5"
            />
          }
          className="size-4 min-h-0 min-w-0"
          hitSlop={14}
          onPress={() => setIsOpen(true)}
          testID="report-this-week-record-info"
        />
      </Popover.Trigger>
      <HintPopoverContent placement="bottom" align="start" description={description} />
    </Popover>
  );
};

ThisWeekRecord.Loading = function Loading() {
  return (
    <VStack gap={16}>
      <TextSkeleton size="b3" className="w-32" />
      <VStack gap={8}>
        <DailyCompletionChart.Loading />
        <TextSkeleton size="b4" className="w-48" />
      </VStack>
    </VStack>
  );
};

ThisWeekRecord.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return <QueryErrorFallback.Inline message={t('errorBoundary.title')} reset={reset} />;
};

function Stat({ label, value }: { label: string; value: string }) {
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

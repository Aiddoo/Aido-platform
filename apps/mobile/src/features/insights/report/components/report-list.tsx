import { useGetWeeklyAchievementsInfiniteQueryOptions } from '@src/features/insights/achievement/queries/achievement.queries';
import { getIsoWeekYear } from '@src/shared/date/date-key';
import { formatDateKeyRange, formatIsoWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HStack,
  LabelChip,
  LockIcon,
  QueryErrorBoundary,
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
  useSuspenseQuery,
} from '@tanstack/react-query';
import { orderBy, range, take } from 'es-toolkit';
import { Link, router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

import { ReportStatusPolicy } from '../domains/report-status.model';
import type { AiReport } from '../domains/report.model';
import { useReportType } from '../hooks/use-report-type';
import {
  useGetReportsQueryOptions,
  useGetReportStatusQueryOptions,
} from '../queries/report.queries';
import { getReportTypeLabelKey } from '../utils/report-label.view-model';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import { CompletionRateHeadline } from './completion-rate-headline';
import { CompletionTrendLine } from './completion-trend-line';
import { ReportTypeChip } from './report-type-chip';
import { ThisWeekRecord } from './this-week-record';

const LOADING_CARD_COUNT = 3;
const LOADING_STAT_COUNT = 3;
/** 서버 기본 페이지 크기와 같다. 목록에는 더 보기가 없어 개수가 이 값으로 묶인다 */
const REPORT_LIST_LIMIT = 10;
const TREND_WEEK_COUNT = 8;

export function ReportList() {
  const { t } = useTranslation('ai');

  const [reportType] = useReportType();
  usePrefetchQuery(useGetReportStatusQueryOptions());
  // 최근 리포트의 추세가 목록을 받은 뒤에야 조회를 시작하지 않게 함께 건다
  usePrefetchInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: getIsoWeekYear(useTodayKey()) }),
  );
  const { data: reports } = useSuspenseQuery(
    useGetReportsQueryOptions({ type: reportType, limit: REPORT_LIST_LIMIT }),
  );

  const [latestReport, ...pastReports] = reports;

  if (latestReport == null) {
    return <ReportList.Empty />;
  }

  return (
    <VStack gap={20}>
      <ReportList.Latest report={latestReport} />

      {pastReports.length > 0 && (
        <VStack className="gap-1">
          <Text size="b3" weight="semibold" shade={9}>
            {t('report.list.pastReports')}
          </Text>
          {pastReports.map((report, index) => (
            <ReportList.Item
              key={report.id}
              report={report}
              isLast={index === pastReports.length - 1}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

ReportList.Latest = function Latest({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  // Item과 같은 이유로 Link와 같은 navigate를 쓴다
  const navigate = useSingleTap(router.navigate);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const href = {
    pathname: '/reports/[reportId]',
    params: { reportId: String(report.id) },
  } as const;

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <PressableFeedback className="rounded-2xl">
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

            <QueryErrorBoundary fallback={RecentCompletionTrend.Error}>
              <Suspense fallback={<RecentCompletionTrend.Loading />}>
                <RecentCompletionTrend />
              </Suspense>
            </QueryErrorBoundary>

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
  isLast?: boolean;
}

ReportList.Item = function Item({ report, isLast = false }: ReportListItemProps) {
  const { t } = useTranslation('ai');
  // Link가 navigate로 열어 같은 상세는 한 번만 쌓인다. 안쪽 버튼·메뉴도 같은 동사여야 겹쳐 쌓이지 않는다
  const navigate = useSingleTap(router.navigate);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const href = {
    pathname: '/reports/[reportId]',
    params: { reportId: String(report.id) },
  } as const;

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
                <Text size="b4" shade={7} numberOfLines={2}>
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

ReportList.Free = function Free() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation(['ai', 'subscription']);
  const fontScaledSize = useFontScaledSize();

  return (
    <VStack gap={16}>
      <QueryErrorBoundary fallback={ThisWeekRecord.Error}>
        <Suspense fallback={<ThisWeekRecord.Loading />}>
          <ThisWeekRecord />
        </Suspense>
      </QueryErrorBoundary>

      <VStack gap={12} className="rounded-2xl bg-gray-1 p-4">
        <HStack align="center" gap={6}>
          <LabelChip
            color="accent"
            label={t('subscription:tier.premium')}
            labelProps={{ weight: 'semibold', numberOfLines: 1 }}
            pointerEvents="none"
          />
          <LockIcon
            width={fontScaledSize(16)}
            height={fontScaledSize(16)}
            colorClassName="text-gray-5"
          />
        </HStack>

        <VStack gap={8} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Box className="h-6 w-40 rounded-md bg-gray-3" />
          <Box className="h-4 w-full rounded-md bg-gray-2" />
          <Box className="h-4 w-4/5 rounded-md bg-gray-2" />
        </VStack>

        <Text size="b4" shade={7}>
          {t('ai:report.list.lockDescription')}
        </Text>

        <Button
          size="medium"
          onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_REPORT' } })}
        >
          {t('ai:report.list.subscribeCta')}
        </Button>
      </VStack>
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
        {range(LOADING_CARD_COUNT).map((i) => (
          <Box key={i}>
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

            {i < LOADING_CARD_COUNT - 1 && <DashedDivider />}
          </Box>
        ))}
      </VStack>
    </VStack>
  );
};

ReportList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

ReportList.Empty = function Empty() {
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  // 상태 쿼리의 로딩·오류는 ReportStatusBanner 경계가 맡는다. 여기서 읽으면 한 오류가 두 곳에 뜬다
  const { data: status } = useQuery(useGetReportStatusQueryOptions());
  const reportLabel = t(getReportTypeLabelKey(reportType));

  return (
    <VStack gap={16}>
      <QueryErrorBoundary fallback={ThisWeekRecord.Error}>
        <Suspense fallback={<ThisWeekRecord.Loading />}>
          <ThisWeekRecord />
        </Suspense>
      </QueryErrorBoundary>

      {status == null ? (
        <TextSkeleton size="b3" className="mx-auto w-48" />
      ) : (
        <Text size="b3" shade={7} align="center">
          {match(ReportStatusPolicy.getDaysUntilReport(status, reportType))
            .with(0, () => t('report.list.arrivalToday', { type: reportLabel }))
            .otherwise((count) => t('report.list.arrivalInDays', { count, type: reportLabel }))}
        </Text>
      )}
    </VStack>
  );
};

function RecentCompletionTrend() {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const { data: weeklyAchievements } = useSuspenseInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: getIsoWeekYear(todayKey) }),
  );

  // 목록은 최근 주부터 오므로 앞에서 자른 뒤 오래된 주부터 그린다
  const recentWeeks = orderBy(take(weeklyAchievements.items, TREND_WEEK_COUNT), ['week'], ['asc']);
  const firstWeek = recentWeeks[0];
  const lastWeek = recentWeeks.at(-1);

  if (firstWeek == null || lastWeek == null) {
    return <CompletionTrendLine.Empty message={t('report.latest.trendEmpty')} />;
  }

  return (
    <VStack gap={8}>
      <Text size="b4" shade={6}>
        {t('report.latest.trendTitle')}
      </Text>
      <CompletionTrendLine
        values={recentWeeks.map((week) => week.completionRate)}
        startLabel={formatIsoWeekLabel(firstWeek.dateRange.startDate, todayKey, dateFormatContext)}
        endLabel={formatIsoWeekLabel(lastWeek.dateRange.startDate, todayKey, dateFormatContext)}
        accessibilityLabel={t('report.latest.trendLabel', {
          count: recentWeeks.length,
          start: formatPercent(firstWeek.completionRate, dateFormatContext.locale),
          end: formatPercent(lastWeek.completionRate, dateFormatContext.locale),
        })}
      />
    </VStack>
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

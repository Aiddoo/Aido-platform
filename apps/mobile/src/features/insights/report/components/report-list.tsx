import { formatDateKeyRange } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/number-format';
import { usePrefetchQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Link, router } from 'expo-router';
import { Chip, PressableFeedback, Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

import { REPORT_TYPE_LABEL_KEYS } from '../constants/report-labels';
import { getSampleReport, SAMPLE_REPORT_IDS } from '../constants/sample-reports.constants';
import { type AiReport, ReportStatusPolicy } from '../domains/report.model';
import { useReportType } from '../hooks/use-report-type';
import {
  useGetReportsQueryOptions,
  useGetReportStatusQueryOptions,
} from '../queries/report.queries';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import { ReportTypeChip } from './report-type-chip';

const LOADING_CARD_COUNT = 3;
const LOADING_STAT_COUNT = 3;
/** 서버 기본 페이지 크기와 같다. 목록에는 더 보기가 없어 개수가 이 값으로 묶인다 */
const REPORT_LIST_LIMIT = 10;

export function ReportList() {
  const [reportType] = useReportType();
  usePrefetchQuery(useGetReportStatusQueryOptions());
  const { data: reports } = useSuspenseQuery(
    useGetReportsQueryOptions({ type: reportType, limit: REPORT_LIST_LIMIT }),
  );

  if (reports.length === 0) {
    return <ReportList.Empty />;
  }

  return (
    <VStack gap={4}>
      {reports.map((report, index) => (
        <ReportList.Item key={report.id} report={report} isLast={index === reports.length - 1} />
      ))}
    </VStack>
  );
}

interface ReportListItemProps {
  report: AiReport;
  isSample?: boolean;
  isLast?: boolean;
}

ReportList.Item = function Item({ report, isSample = false, isLast = false }: ReportListItemProps) {
  const { t } = useTranslation('ai');
  // Link가 navigate로 열어 같은 상세는 한 번만 쌓인다. 안쪽 버튼·메뉴도 같은 동사여야 겹쳐 쌓이지 않는다
  const navigate = useSingleTap(router.navigate);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const reportId = isSample ? SAMPLE_REPORT_IDS[report.type] : String(report.id);
  const href = { pathname: '/reports/[reportId]', params: { reportId } } as const;

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <PressableFeedback className="rounded-xl">
          <PressableFeedback.Highlight className="rounded-xl" />
          <Box className={cn('py-3', !report.hasActivity && 'opacity-50')}>
            <VStack gap={10}>
              <HStack justify="between" align="center">
                <HStack align="center" gap={6}>
                  {/* Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 줄이 눌리지 않는다 */}
                  {isSample && (
                    <Chip size="sm" variant="soft" color="warning" pointerEvents="none">
                      <Text size="e1" weight="medium" tone="warning">
                        {t('report.sampleBadge')}
                      </Text>
                    </Chip>
                  )}
                  <ReportTypeChip type={report.type} pointerEvents="none" />
                </HStack>

                <VStack align="end">
                  <Text size="b4" shade={7}>
                    {formatReportPeriodLabel(report, dateFormatContext)}
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
                  value={`${formatPercent(report.stats.completionRate)}%`}
                />
                <Stat
                  label={t('report.card.completed')}
                  value={`${report.stats.completedTodos}/${report.stats.totalTodos}`}
                />
                <Stat
                  label={t('report.card.streak')}
                  value={t('report.card.streakDays', { count: report.stats.streakDays })}
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
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportList.Item report={sampleReport} isSample isLast />
      </Box>

      <Button
        size="medium"
        onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_REPORT' } })}
      >
        {t('report.list.subscribeCta')}
      </Button>
    </VStack>
  );
};

ReportList.Loading = function Loading() {
  return (
    <VStack gap={4}>
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
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);
  const reportLabel = t(REPORT_TYPE_LABEL_KEYS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportList.Item report={sampleReport} isSample isLast />
      </Box>

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

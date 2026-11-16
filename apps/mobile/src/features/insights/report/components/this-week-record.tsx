import { useGetDailyCompletionsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { formatDailyValueLine } from '../utils/report-chart.view-model';
import { getWeeklyRecordDays, getWeeklyRecordRange } from '../utils/weekly-record.view-model';
import { DailyCompletionChart } from './daily-completion-chart';

export function ThisWeekRecord() {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const { data: completionsByDate } = useSuspenseQuery(
    useGetDailyCompletionsQueryOptions(getWeeklyRecordRange(todayKey)),
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const days = getWeeklyRecordDays(completionsByDate, todayKey);
  const valueLine = formatDailyValueLine(
    selectedIndex == null ? null : (days[selectedIndex] ?? null),
    dateFormatContext,
  );

  // 리포트 없이 할 일 기록만 그린 차트라 리포트 차트와 다른 값으로 세고 AI 리포트 사용으로 치지 않는다
  const handleSelectedIndexChange = (index: number) => {
    if (selectedIndex == null) {
      trackEvent('ai_report_chart_tapped', { chart: 'this_week_record' });
    }
    setSelectedIndex(index);
  };

  return (
    <VStack gap={16} testID="report-this-week-record">
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.thisWeek.title')}
      </Text>
      <VStack gap={8}>
        <DailyCompletionChart
          values={days}
          labels={days.map((day) => formatDateKeyLabel(day.date, 'weekday', dateFormatContext))}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={handleSelectedIndexChange}
          accessibilityLabel={t('report.thisWeek.title')}
          accessibilityValue={{ text: valueLine }}
        />
        <Text size="b4" shade={7} className="tabular-nums">
          {valueLine}
        </Text>
      </VStack>
    </VStack>
  );
}

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

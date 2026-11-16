import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
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
import { match } from 'ts-pattern';

import { getWeeklyRecordDays, getWeeklyRecordRange } from '../utils/weekly-record.view-model';
import { DailyCompletionChart } from './daily-completion-chart';

export function ThisWeekRecord() {
  const { t } = useTranslation('ai');
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const { data: completionsByDate } = useSuspenseQuery(
    useGetDailyCompletionsQueryOptions(getWeeklyRecordRange(todayKey)),
  );
  const accountId = useMyAccountId();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const days = getWeeklyRecordDays(completionsByDate, todayKey);
  const selectedDay = selectedIndex == null ? null : days[selectedIndex];
  const valueLine = match(selectedDay)
    .with(undefined, null, () => t('report.detail.dailyHint'))
    .when(
      (day) => day.isUpcoming,
      (day) =>
        t('report.thisWeek.dayUpcoming', {
          date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        }),
    )
    .when(
      (day) => day.total === 0,
      (day) =>
        t('report.detail.dayEmpty', {
          date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        }),
    )
    .otherwise((day) =>
      t('report.detail.dayCompletions', {
        date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        completed: day.completed,
        total: day.total,
      }),
    );

  const handleSelectedIndexChange = (index: number) => {
    if (selectedIndex == null) {
      trackEvent('ai_report_chart_tapped', { chart: 'daily_completions' });
      if (accountId != null) {
        trackAttributedFeatureSuccess({ accountId, feature: 'ai_report' });
      }
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
          values={days.map((day) => ({
            total: day.total,
            completed: day.completed,
            isUpcoming: day.isUpcoming,
          }))}
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

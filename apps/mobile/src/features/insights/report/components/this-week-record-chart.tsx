import type { DateKey } from '@src/shared/date/date-key';
import { formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { Text, VStack } from '@src/shared/ui';
import { useState } from 'react';

import { formatDailyValueLine } from '../utils/report-chart.view-model';
import { type CompletionsByDate, getWeeklyRecordDays } from '../utils/weekly-record.view-model';
import { DailyCompletionChart } from './daily-completion-chart';

interface ThisWeekRecordChartProps {
  completionsByDate: CompletionsByDate;
  todayKey: DateKey;
  accessibilityLabel: string;
  /** 처음 막대를 고를 때 한 번 */
  onFirstTap?: () => void;
}

/** 이번 주(월요일 시작) 막대와 고른 날 한 줄. 받은 기록만 그리고 조회하지 않는다 */
export function ThisWeekRecordChart({
  completionsByDate,
  todayKey,
  accessibilityLabel,
  onFirstTap,
}: ThisWeekRecordChartProps) {
  const dateFormatContext = useDateFormatContext();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const days = getWeeklyRecordDays(completionsByDate, todayKey);
  const valueLine = formatDailyValueLine(
    selectedIndex == null ? null : (days[selectedIndex] ?? null),
    dateFormatContext,
  );

  const handleSelectedIndexChange = (index: number) => {
    if (selectedIndex == null) {
      onFirstTap?.();
    }
    setSelectedIndex(index);
  };

  return (
    <VStack gap={8}>
      <DailyCompletionChart
        values={days}
        labels={days.map((day) => formatDateKeyLabel(day.date, 'weekday', dateFormatContext))}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={handleSelectedIndexChange}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: valueLine }}
      />
      <Text size="b4" shade={7} className="tabular-nums">
        {valueLine}
      </Text>
    </VStack>
  );
}

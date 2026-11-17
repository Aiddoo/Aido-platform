import { useGetDailyCompletionsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  HintPopoverContent,
  HStack,
  IconButton,
  InfoIcon,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Popover } from 'heroui-native';
import { useState } from 'react';
import { match } from 'ts-pattern';

import { formatDailyValueLine } from '../utils/report-chart.view-model';
import { getWeeklyRecordDays, getWeeklyRecordRange } from '../utils/weekly-record.view-model';
import { DailyCompletionChart } from './daily-completion-chart';

interface ThisWeekRecordProps {
  /** 무료는 AI 분석을 프리미엄에서, 첫 리포트 전 프리미엄은 리포트가 오면 받는다고 안내한다 */
  access: 'free' | 'premium';
}

export function ThisWeekRecord({ access }: ThisWeekRecordProps) {
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

/** 제목 옆 ⓘ. 막대가 무엇이고 누르면 무엇이 보이는지, AI 분석은 어디서 받는지 알린다 */
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

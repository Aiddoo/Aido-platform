import { useCalendarViewMode } from '@src/features/todo/presentations/hooks/use-calendar-view-mode';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { Box, HStack, Text, VStack } from '@src/shared/ui';
import {
  getCalendarRange,
  getMonthHeaderText,
  getWeekHeaderText,
  getWeekRange,
  WEEKDAY_LABELS,
} from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { match } from 'ts-pattern';
import type { CompletionsByDate } from '../../queries/use-get-daily-completions-query-options';
import { useGetDailyCompletionsQueryOptions } from '../../queries/use-get-daily-completions-query-options';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarNavigation } from './CalendarNavigation';
import { CalendarViewModeToggle } from './CalendarViewModeToggle';
import { CalendarWeekView } from './CalendarWeekView';
import type { CalendarViewMode } from './calendar.types';

interface CalendarProps {
  showCompletions?: boolean;
}

const EMPTY_COMPLETIONS: CompletionsByDate = {};

export function Calendar({ showCompletions = true }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const [viewMode, setViewMode] = useCalendarViewMode();

  const { rangeStart, rangeEnd } = useMemo(
    () =>
      match(viewMode)
        .with('week', () => getWeekRange(selectedDate))
        .with('month', () => getCalendarRange(selectedDate))
        .exhaustive(),
    [viewMode, selectedDate],
  );

  const { data } = useQuery({
    ...useGetDailyCompletionsQueryOptions(rangeStart, rangeEnd),
    enabled: showCompletions,
  });

  const completions = (showCompletions && data) || EMPTY_COMPLETIONS;

  return (
    <VStack className="bg-background" gap={8}>
      <HStack className="px-4 py-2" justify="between" align="center">
        <HStack gap={8} align="center">
          <CalendarHeaderText viewMode={viewMode} displayDate={selectedDate} />
          <PressableFeedback
            onPress={() => setSelectedDate(new Date())}
            className="px-2 py-0.5 bg-gray-2 rounded-full"
          >
            <Text size="e1" weight="medium" shade={7}>
              오늘
            </Text>
          </PressableFeedback>
        </HStack>

        <HStack gap={8} align="center">
          <CalendarViewModeToggle value={viewMode} onChange={setViewMode} />
          <CalendarNavigation viewMode={viewMode} value={selectedDate} onChange={setSelectedDate} />
        </HStack>
      </HStack>

      {match(viewMode)
        .with('week', () => (
          <CalendarWeekView
            value={selectedDate}
            onChange={setSelectedDate}
            completions={completions}
          />
        ))
        .with('month', () => (
          <CalendarMonthView
            value={selectedDate}
            onChange={setSelectedDate}
            completions={completions}
          />
        ))
        .exhaustive()}
    </VStack>
  );
}

interface CalendarHeaderTextProps {
  viewMode: CalendarViewMode;
  displayDate: Date;
}

function CalendarHeaderText({ viewMode, displayDate }: CalendarHeaderTextProps) {
  const headerText = match(viewMode)
    .with('week', () => getWeekHeaderText(displayDate))
    .with('month', () => getMonthHeaderText(displayDate))
    .exhaustive();

  return (
    <Text size="b1" weight="semibold">
      {headerText}
    </Text>
  );
}

Calendar.Loading = function Loading() {
  return (
    <VStack className="bg-background" gap={8}>
      <HStack className="px-4 py-2" justify="between" align="center">
        <Skeleton className="h-6 w-24" />
        <HStack gap={8}>
          <Skeleton className="h-8 w-12 rounded-full" />
          <Skeleton className="h-8 w-12 rounded-full" />
        </HStack>
      </HStack>

      <HStack px={8}>
        {WEEKDAY_LABELS.map((label) => (
          <Box key={`weekday-skeleton-${label}`} className="flex-1 items-center py-2">
            <Skeleton className="size-4" />
          </Box>
        ))}
      </HStack>

      <HStack px={8}>
        {WEEKDAY_LABELS.map((label) => (
          <Box key={`date-skeleton-${label}`} className="flex-1 items-center py-2">
            <Skeleton className="size-8 overflow-hidden rounded-2xl" />
          </Box>
        ))}
      </HStack>
    </VStack>
  );
};

import { useCalendarViewMode } from '@src/features/todo/presentations/hooks/use-calendar-view-mode';
import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { Box, HStack, SwipePager, Text, VStack } from '@src/shared/ui';
import {
  formatDate,
  getCalendarRange,
  getMonthHeaderText,
  getMonthWeeks,
  getNextMonth,
  getNextWeek,
  getPreviousMonth,
  getPreviousWeek,
  getWeekDates,
  getWeekHeaderText,
  getWeekRange,
  getWeekStart,
  WEEKDAY_LABELS,
} from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { View } from 'react-native';
import { match } from 'ts-pattern';
import type { CompletionsByDate } from '../../queries/use-get-daily-completions-query-options';
import { useGetDailyCompletionsQueryOptions } from '../../queries/use-get-daily-completions-query-options';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarNavigation } from './CalendarNavigation';
import { CalendarViewModeToggle } from './CalendarViewModeToggle';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';
import type { CalendarViewMode } from './calendar.types';

interface CalendarProps {
  showCompletions?: boolean;
}

const EMPTY_COMPLETIONS: CompletionsByDate = {};
const DATE_CELL_HEIGHT = 56;
const MONTH_WEEKS = 6;
const CENTER_PAGE = 1;

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

  const pagerHeight = match(viewMode)
    .with('week', () => DATE_CELL_HEIGHT)
    .with('month', () => MONTH_WEEKS * DATE_CELL_HEIGHT)
    .exhaustive();

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

      <CalendarWeekdayHeader />

      <Box style={{ height: pagerHeight }}>
        <CalendarPager
          viewMode={viewMode}
          value={selectedDate}
          onChange={setSelectedDate}
          completions={completions}
        />
      </Box>
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

interface CalendarPagerProps {
  viewMode: CalendarViewMode;
  value: Date;
  onChange: (date: Date) => void;
  completions: CompletionsByDate;
}

const CalendarPager = ({ viewMode, value, onChange, completions }: CalendarPagerProps) => {
  const pages = useMemo(() => {
    const getPrevious = match(viewMode)
      .with('week', () => getPreviousWeek)
      .with('month', () => getPreviousMonth)
      .exhaustive();

    const getNext = match(viewMode)
      .with('week', () => getNextWeek)
      .with('month', () => getNextMonth)
      .exhaustive();

    return [getPrevious(value), value, getNext(value)] as const;
  }, [viewMode, value]);

  const handlePageSelected = (index: number) => {
    if (index === CENTER_PAGE) return;
    const page = pages[index];
    if (page) onChange(page);
  };

  return (
    <SwipePager
      initialPage={CENTER_PAGE}
      resetKey={value.getTime()}
      onPageSelected={handlePageSelected}
    >
      {pages.map((pageDate, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 페이지 순서가 고정됨
        <View key={index}>
          {match(viewMode)
            .with('week', () => (
              <CalendarWeekContent value={pageDate} onChange={onChange} completions={completions} />
            ))
            .with('month', () => (
              <CalendarMonthContent
                value={pageDate}
                onChange={onChange}
                completions={completions}
              />
            ))
            .exhaustive()}
        </View>
      ))}
    </SwipePager>
  );
};

interface CalendarContentProps {
  value: Date;
  onChange: (date: Date) => void;
  completions: CompletionsByDate;
}

const CALENDAR_GRID_ROWS = 6;

const CalendarMonthContent = ({ value, onChange, completions }: CalendarContentProps) => {
  const weeks = getMonthWeeks(value);

  while (weeks.length < CALENDAR_GRID_ROWS) {
    const lastWeek = weeks.at(-1)!;
    const nextWeekStart = dayjs(lastWeek[6]).add(1, 'day').toDate();
    weeks.push(getWeekDates(nextWeekStart));
  }

  return (
    <VStack>
      {weeks.map((week, weekIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 주 순서가 변경되지 않음
        <HStack key={weekIndex} px={8}>
          {week.map((date) => (
            <CalendarDateCell
              key={date.toISOString()}
              date={date}
              selectedDate={value}
              onPress={onChange}
              completion={completions[formatDate(date)]}
            />
          ))}
        </HStack>
      ))}
    </VStack>
  );
};

const CalendarWeekContent = ({ value, onChange, completions }: CalendarContentProps) => {
  const weekStart = getWeekStart(value);
  const dates = getWeekDates(weekStart);

  return (
    <VStack>
      <HStack px={8}>
        {dates.map((date) => (
          <CalendarDateCell
            key={date.toISOString()}
            date={date}
            selectedDate={value}
            onPress={onChange}
            completion={completions[formatDate(date)]}
          />
        ))}
      </HStack>
    </VStack>
  );
};

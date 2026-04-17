import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { Box, FishIcon, HStack, Text, VStack } from '@src/shared/ui';
import {
  addMonths,
  addWeeks,
  formatDate,
  getCalendarRange,
  getMonthHeaderText,
  getMonthStart,
  getMonthWeeks,
  getWeekDates,
  getWeekHeaderText,
  getWeekRange,
  getWeekStart,
  isSameMonth,
  WEEKDAY_LABELS,
  withDayOfMonth,
  withDayOfWeek,
} from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from 'react-native';
import { match } from 'ts-pattern';
import type { DailyCompletionSummary } from '../../../models/todo.model';
import type { CompletionsByDate } from '../../queries/use-get-daily-completions-query-options';
import { useGetDailyCompletionsQueryOptions } from '../../queries/use-get-daily-completions-query-options';
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarNavigation } from './CalendarNavigation';
import { CalendarViewModeToggle } from './CalendarViewModeToggle';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';
import { CalendarProvider, useCalendarContext } from './calendar-view-mode-context';

interface CalendarProps {
  showCompletions?: boolean;
}

const EMPTY_COMPLETIONS: CompletionsByDate = {};
const DATE_CELL_HEIGHT = 56;
const MONTH_WEEKS = 6;
const TOTAL_PAGES = 9;
const CENTER_PAGE = 4;

export function Calendar({ showCompletions = true }: CalendarProps) {
  return (
    <CalendarProvider>
      <CalendarInner showCompletions={showCompletions} />
    </CalendarProvider>
  );
}

function CalendarInner({ showCompletions = true }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const { viewMode } = useCalendarContext();

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

  const handlePrevious = () => {
    const newDate = match(viewMode)
      .with('week', () => dayjs(selectedDate).startOf('week').subtract(1, 'week').toDate())
      .with('month', () => dayjs(selectedDate).startOf('month').subtract(1, 'month').toDate())
      .exhaustive();
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = match(viewMode)
      .with('week', () => dayjs(selectedDate).startOf('week').add(1, 'week').toDate())
      .with('month', () => dayjs(selectedDate).startOf('month').add(1, 'month').toDate())
      .exhaustive();
    setSelectedDate(newDate);
  };

  return (
    <VStack className="bg-background" gap={8}>
      <HStack className="px-4 py-2" justify="between" align="center">
        <HStack gap={8} align="center">
          <CalendarHeaderText displayDate={selectedDate} />
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
          <CalendarViewModeToggle />
          <CalendarNavigation onPrevious={handlePrevious} onNext={handleNext} />
        </HStack>
      </HStack>

      <CalendarWeekdayHeader />

      <Box style={{ height: pagerHeight }}>
        {match(viewMode)
          .with('week', () => <CalendarWeekPager completions={completions} />)
          .with('month', () => <CalendarMonthPager completions={completions} />)
          .exhaustive()}
      </Box>
    </VStack>
  );
}

interface CalendarHeaderTextProps {
  displayDate: Date;
}

function CalendarHeaderText({ displayDate }: CalendarHeaderTextProps) {
  const { viewMode } = useCalendarContext();

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

interface CalendarWeekPagerProps {
  completions: CompletionsByDate;
}

function CalendarWeekPager({ completions }: CalendarWeekPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();

  const [weeks] = useState(() => {
    const start = getWeekStart(selectedDate);
    return times(TOTAL_PAGES, (i) => addWeeks(start, i - CENTER_PAGE));
  });

  const handleChange = (week: Date) => {
    setSelectedDate(withDayOfWeek(week, selectedDate.getDay()));
  };

  return (
    <CalendarPager data={weeks} value={getWeekStart(selectedDate)} onChange={handleChange}>
      {(week) => <WeekRow week={week} completions={completions} />}
    </CalendarPager>
  );
}

interface CalendarMonthPagerProps {
  completions: CompletionsByDate;
}

function CalendarMonthPager({ completions }: CalendarMonthPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();

  const [months] = useState(() => {
    const start = getMonthStart(selectedDate);
    return times(TOTAL_PAGES, (i) => addMonths(start, i - CENTER_PAGE));
  });

  const handleChange = (month: Date) => {
    setSelectedDate(withDayOfMonth(month, selectedDate.getDate()));
  };

  return (
    <CalendarPager data={months} value={getMonthStart(selectedDate)} onChange={handleChange}>
      {(month) => <MonthGrid month={month} completions={completions} />}
    </CalendarPager>
  );
}

interface CalendarPagerProps {
  data: Date[];
  value: Date;
  onChange: (page: Date) => void;
  children: (page: Date) => React.ReactNode;
}

function CalendarPager({ data, value, onChange, children }: CalendarPagerProps) {
  const { width: pageWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<Date>>(null);
  const currentIndexRef = useRef(CENTER_PAGE);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      currentIndexRef.current = index;
      const next = data[index];
      if (next) onChange(next);
    },
    [pageWidth, data, onChange],
  );

  useEffect(() => {
    const target = data.findIndex((page) => page.getTime() === value.getTime());
    if (target === -1 || target === currentIndexRef.current) return;
    const distance = Math.abs(target - currentIndexRef.current);
    currentIndexRef.current = target;
    flatListRef.current?.scrollToIndex({
      index: target,
      animated: distance <= 2,
    });
  }, [value, data]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const renderItem = useCallback(
    ({ item: page }: { item: Date }) => <View style={{ width: pageWidth }}>{children(page)}</View>,
    [pageWidth, children],
  );

  return (
    <FlatList
      ref={flatListRef}
      horizontal
      pagingEnabled
      data={data}
      keyExtractor={(page) => page.toISOString()}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialScrollIndex={CENTER_PAGE}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={handleScrollEnd}
      onScrollToIndexFailed={(info) => {
        flatListRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        });
      }}
      windowSize={5}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
    />
  );
}

interface WeekRowProps {
  week: Date;
  completions: CompletionsByDate;
}

function WeekRow({ week, completions }: WeekRowProps) {
  const dates = getWeekDates(getWeekStart(week));

  return (
    <HStack px={8}>
      {dates.map((date) => (
        <CalendarDateCell key={date.toISOString()} date={date}>
          <CompletionIndicator completion={completions[formatDate(date)]} />
        </CalendarDateCell>
      ))}
    </HStack>
  );
}

interface MonthGridProps {
  month: Date;
  completions: CompletionsByDate;
}

function MonthGrid({ month, completions }: MonthGridProps) {
  const weeks = fillMonthGrid(getMonthWeeks(month));

  return (
    <VStack>
      {weeks.map((week, weekIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 주 순서가 변경되지 않음
        <HStack key={weekIndex} px={8}>
          {week.map((date) => (
            <CalendarDateCell
              key={date.toISOString()}
              date={date}
              className={isSameMonth(date, month) ? undefined : 'opacity-20'}
            >
              <CompletionIndicator completion={completions[formatDate(date)]} />
            </CalendarDateCell>
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

function fillMonthGrid(weeks: Date[][]): Date[][] {
  const filled = [...weeks];
  while (filled.length < MONTH_WEEKS) {
    const lastWeek = filled.at(-1);
    if (!lastWeek) break;
    const nextWeekStart = dayjs(lastWeek[6]).add(1, 'day').toDate();
    filled.push(getWeekDates(nextWeekStart));
  }
  return filled;
}

interface CompletionIndicatorProps {
  completion?: DailyCompletionSummary;
}

function CompletionIndicator({ completion }: CompletionIndicatorProps) {
  if (!completion) return null;
  if (completion.isComplete) {
    return <FishIcon width={16} height={12} colorClassName="text-fish" />;
  }
  if (completion.totalTodos > 0) {
    return <CategoryIndicator colors={completion.categoryColors ?? []} />;
  }
  return null;
}

interface CategoryIndicatorProps {
  colors: string[];
}

function CategoryIndicator({ colors }: CategoryIndicatorProps) {
  if (colors.length <= 1) {
    return (
      <Box style={{ backgroundColor: colors[0] ?? '#9CA3AF' }} className="size-1.5 rounded-2xl" />
    );
  }

  return (
    <HStack className="h-1.5 w-4 overflow-hidden rounded-2xl">
      {colors.slice(0, 3).map((color) => (
        <Box key={color} style={{ backgroundColor: color }} className="flex-1" />
      ))}
    </HStack>
  );
}

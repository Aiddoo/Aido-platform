import { useFeedDate } from '@src/features/todo/presentations/hooks/use-feed-date';
import { useTranslation } from '@src/shared/i18n';
import { Box, FishIcon, HStack, Text, VStack } from '@src/shared/ui';
import {
  addMonths,
  addWeeks,
  diffMonths,
  diffWeeks,
  formatDate,
  getMonthHeaderText,
  getMonthStart,
  getMonthWeeks,
  getNextDay,
  getWeekDates,
  getWeekHeaderText,
  getWeekStart,
  isSameMonth,
  withDayOfMonth,
  withDayOfWeek,
} from '@src/shared/utils/date';
import { range } from 'es-toolkit/compat';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useCallback, useEffect, useRef } from 'react';
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
import { CalendarDateCell } from './CalendarDateCell';
import { CalendarNavigation } from './CalendarNavigation';
import { CalendarViewModeToggle } from './CalendarViewModeToggle';
import { CalendarWeekdayHeader } from './CalendarWeekdayHeader';
import { useCalendarContext } from './calendar-view-mode-context';

const EMPTY_COMPLETIONS: CompletionsByDate = {};
const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;
const DATE_CELL_HEIGHT = 56;
const MONTH_WEEKS = 6;
const TOTAL_PAGES = 521;
const CENTER_PAGE = 260;
const PAGES = range(TOTAL_PAGES);

interface CalendarProps {
  completions?: CompletionsByDate;
}

export function Calendar({ completions = EMPTY_COMPLETIONS }: CalendarProps) {
  const { t } = useTranslation('common');
  const [selectedDate, setSelectedDate] = useFeedDate();
  const { viewMode } = useCalendarContext();

  const pagerHeight = match(viewMode)
    .with('week', () => DATE_CELL_HEIGHT)
    .with('month', () => MONTH_WEEKS * DATE_CELL_HEIGHT)
    .exhaustive();

  const handlePrevious = () => {
    const newDate = match(viewMode)
      .with('week', () => addWeeks(getWeekStart(selectedDate), -1))
      .with('month', () => addMonths(getMonthStart(selectedDate), -1))
      .exhaustive();
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = match(viewMode)
      .with('week', () => addWeeks(getWeekStart(selectedDate), 1))
      .with('month', () => addMonths(getMonthStart(selectedDate), 1))
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
              {t('dateSections.today')}
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
        {WEEKDAY_INDICES.map((dayIndex) => (
          <Box key={`weekday-skeleton-${dayIndex}`} className="flex-1 items-center py-2">
            <Skeleton className="size-4" />
          </Box>
        ))}
      </HStack>

      <HStack px={8}>
        {WEEKDAY_INDICES.map((dayIndex) => (
          <Box key={`date-skeleton-${dayIndex}`} className="flex-1 items-center py-2">
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
  const baseWeekRef = useRef(getWeekStart(selectedDate));

  const weekAtPage = useCallback(
    (page: number) => addWeeks(baseWeekRef.current, page - CENTER_PAGE),
    [],
  );

  const pageOfWeek = useCallback((week: Date) => {
    const page = diffWeeks(week, baseWeekRef.current) + CENTER_PAGE;
    return Math.max(0, Math.min(TOTAL_PAGES - 1, page));
  }, []);

  const handleChange = (page: number) => {
    const week = weekAtPage(page);
    setSelectedDate(withDayOfWeek(week, selectedDate.getDay()));
  };

  return (
    <CalendarPager data={PAGES} value={pageOfWeek(selectedDate)} onChange={handleChange}>
      {(page) => <WeekRow week={weekAtPage(page)} completions={completions} />}
    </CalendarPager>
  );
}

interface CalendarMonthPagerProps {
  completions: CompletionsByDate;
}

function CalendarMonthPager({ completions }: CalendarMonthPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const baseMonthRef = useRef(getMonthStart(selectedDate));

  const monthAtPage = useCallback(
    (page: number) => addMonths(baseMonthRef.current, page - CENTER_PAGE),
    [],
  );

  const pageOfMonth = useCallback((month: Date) => {
    const page = diffMonths(month, baseMonthRef.current) + CENTER_PAGE;
    return Math.max(0, Math.min(TOTAL_PAGES - 1, page));
  }, []);

  const handleChange = (page: number) => {
    const month = monthAtPage(page);
    setSelectedDate(withDayOfMonth(month, selectedDate.getDate()));
  };

  return (
    <CalendarPager data={PAGES} value={pageOfMonth(selectedDate)} onChange={handleChange}>
      {(page) => <MonthGrid month={monthAtPage(page)} completions={completions} />}
    </CalendarPager>
  );
}

interface CalendarPagerProps {
  data: number[];
  value: number;
  onChange: (page: number) => void;
  children: (page: number) => React.ReactNode;
}

function CalendarPager({ data, value, onChange, children }: CalendarPagerProps) {
  const { width: pageWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<number>>(null);
  const currentPageRef = useRef(CENTER_PAGE);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      currentPageRef.current = page;
      onChange(page);
    },
    [pageWidth, onChange],
  );

  useEffect(() => {
    if (value === currentPageRef.current) return;
    const distance = Math.abs(value - currentPageRef.current);
    currentPageRef.current = value;
    flatListRef.current?.scrollToIndex({
      index: value,
      animated: distance <= 2,
    });
  }, [value]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const renderItem = useCallback(
    ({ item: page }: { item: number }) => (
      <View style={{ width: pageWidth }}>{children(page)}</View>
    ),
    [pageWidth, children],
  );

  return (
    <FlatList
      ref={flatListRef}
      horizontal
      pagingEnabled
      data={data}
      keyExtractor={(page) => String(page)}
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
    const lastDate = lastWeek?.[6];
    if (!lastDate) break;
    filled.push(getWeekDates(getNextDay(lastDate)));
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

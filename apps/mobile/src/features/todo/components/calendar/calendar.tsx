import { useFeedDate, useFeedDateKey } from '@src/features/todo/hooks/use-feed-date';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, FishIcon, HStack, Result, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  addMonths,
  addWeeks,
  diffMonths,
  diffWeeks,
  formatDate,
  formatWeekOfMonthLabel,
  getMonthStart,
  getMonthWeeks,
  getNextDay,
  getWeekDates,
  getWeekStart,
  isSameMonth,
  withDayOfMonth,
  withDayOfWeek,
} from '@src/shared/utils/date';
import { formatDateKeyLabel } from '@src/shared/utils/date-format';
import { range } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { match } from 'ts-pattern';

import type { DailyCompletionSummary } from '../../domains/todo.model';
import type { CompletionsByDate } from '../../queries/get-daily-completions-query-options';
import {
  clampCalendarPage,
  getCalendarPageAtOffset,
  shiftCalendarDate,
} from '../../utils/view-models/calendar-paging.view-model';
import { useCalendarContext } from '../providers/calendar-provider';
import { CalendarDateCell } from './calendar-date-cell';
import { CalendarNavigation } from './calendar-navigation';
import { CalendarViewModeToggle } from './calendar-view-mode-toggle';
import { CalendarWeekdayHeader } from './calendar-weekday-header';

const EMPTY_COMPLETIONS: CompletionsByDate = {};
const DATE_CELL_HEIGHT = 56;
const MONTH_WEEKS = 6;
const TOTAL_PAGES = 521;
const CENTER_PAGE = 260;
const PAGES = range(TOTAL_PAGES);

interface CalendarProps {
  completions?: CompletionsByDate;
  status?: ReactNode;
}

export function Calendar({ completions = EMPTY_COMPLETIONS, status }: CalendarProps) {
  const { t } = useTranslation('common');
  const [selectedDate, setSelectedDate] = useFeedDate();
  const today = useToday();
  const { viewMode } = useCalendarContext();

  const pagerHeight = match(viewMode)
    .with('week', () => DATE_CELL_HEIGHT)
    .with('month', () => MONTH_WEEKS * DATE_CELL_HEIGHT)
    .exhaustive();

  const handlePrevious = () => setSelectedDate(shiftCalendarDate(viewMode, selectedDate, -1));
  const handleNext = () => setSelectedDate(shiftCalendarDate(viewMode, selectedDate, 1));

  return (
    <VStack className="bg-background" gap={8}>
      <HStack className="px-4 py-2" justify="between" align="center">
        <HStack gap={8} align="center">
          <CalendarHeaderText />
          <PressableFeedback
            onPress={() => setSelectedDate(today)}
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
      {status}
    </VStack>
  );
}

function CalendarHeaderText() {
  const { viewMode } = useCalendarContext();
  const selectedDateKey = useFeedDateKey();
  const dateFormatContext = useDateFormatContext();

  const headerText = match(viewMode)
    .with('week', () => formatWeekOfMonthLabel(selectedDateKey, dateFormatContext))
    .with('month', () => formatDateKeyLabel(selectedDateKey, 'yearMonth', dateFormatContext))
    .exhaustive();

  return (
    <Text size="b1" weight="semibold">
      {headerText}
    </Text>
  );
}

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

  const pageOfWeek = useCallback(
    (week: Date) =>
      clampCalendarPage(diffWeeks(week, baseWeekRef.current) + CENTER_PAGE, TOTAL_PAGES),
    [],
  );

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

  const pageOfMonth = useCallback(
    (month: Date) =>
      clampCalendarPage(diffMonths(month, baseMonthRef.current) + CENTER_PAGE, TOTAL_PAGES),
    [],
  );

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
  // 측정 전 첫 프레임은 예전처럼 창 너비로 그려 달력 높이가 0에서 튀어나오지 않게 한다.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredPageWidth, setMeasuredPageWidth] = useState<number | null>(null);
  const pageWidth = measuredPageWidth ?? windowWidth;
  const flatListRef = useRef<FlatList<number>>(null);
  const currentPageRef = useRef(CENTER_PAGE);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const page = getCalendarPageAtOffset({
        offsetX: contentOffset.x,
        viewportWidth: layoutMeasurement.width,
        totalPages: data.length,
      });
      if (page === currentPageRef.current) {
        return;
      }
      currentPageRef.current = page;
      onChange(page);
    },
    [data.length, onChange],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredPageWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (value === currentPageRef.current) {
      return;
    }
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
    ({ item: page }: { item: number }) => <Box style={{ width: pageWidth }}>{children(page)}</Box>,
    [pageWidth, children],
  );

  return (
    <Box onLayout={handleLayout}>
      {/* 너비가 바뀌면(측정·접기·펼치기) 새 목록으로 현재 페이지에서 시작한다. 이전 오프셋을 그대로 두면
          콘텐츠가 줄어들 때 네이티브가 마지막 페이지(+260주)로 잘라 내 몇 년 뒤 날짜가 선택된다. */}
      <FlatList
        key={pageWidth}
        ref={flatListRef}
        horizontal
        pagingEnabled
        data={data}
        keyExtractor={(page) => String(page)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={currentPageRef.current}
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
    </Box>
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
        // 주 순서는 고정되어 index가 안정적인 key다.
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
    if (!lastDate) {
      break;
    }
    filled.push(getWeekDates(getNextDay(lastDate)));
  }
  return filled;
}

interface CompletionIndicatorProps {
  completion?: DailyCompletionSummary;
}

function CompletionIndicator({ completion }: CompletionIndicatorProps) {
  if (!completion) {
    return null;
  }
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
  const [firstColor] = colors;

  if (colors.length <= 1) {
    return (
      <Box
        className={cn('size-1.5 rounded-2xl', !firstColor && 'bg-gray-5')}
        style={firstColor ? { backgroundColor: firstColor } : undefined}
      />
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

Calendar.Error = function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <HStack px={16} py={4} align="center" gap={8}>
      <Text size="e1" shade={6} className="flex-1">
        {t('todo:calendar.loadFailed')}
      </Text>
      <Result.Button onPress={onRetry}>{t('common:actions.retry')}</Result.Button>
    </HStack>
  );
};

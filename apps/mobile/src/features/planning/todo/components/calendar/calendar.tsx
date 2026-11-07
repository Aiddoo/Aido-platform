import { useCalendarViewMode } from '@src/features/planning/todo/hooks/use-calendar-view-mode';
import {
  useFeedDateParam,
  useFeedDateKey,
} from '@src/features/planning/todo/hooks/use-feed-params';
import {
  diffMonths,
  diffWeeks,
  getMonthWeeks,
  getWeekDates,
  getWeekStart,
  isSameMonth,
  shiftCalendarDate,
} from '@src/features/planning/todo/utils/calendar-date';
import { formatDateKeyLabel } from '@src/shared/date/date-format';
import { formatWeekOfMonthLabel } from '@src/shared/date/date-labels';
import { toDateKey } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday, useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  type CalendarViewMode,
  calendarViewModeSchema,
} from '@src/shared/preferences/calendar-view-mode.preference';
import { Box, FishIcon, HStack, Result, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import dayjs from 'dayjs';
import { range } from 'es-toolkit';
import { PressableFeedback, Tabs } from 'heroui-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { match } from 'ts-pattern';

import type { CompletionsByDate } from '../../queries/todo.queries';
import type { DailyCompletionSummary } from '../../schemas/todo.schema';
import { clampCalendarPage, getCalendarPageAtOffset } from '../../utils/calendar-pager.geometry';
import { CalendarDateCell } from './calendar-date-cell';
import { CalendarNavigation } from './calendar-navigation';
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
  const [selectedDate, setSelectedDate] = useFeedDateParam();
  const today = useToday();
  const [viewMode] = useCalendarViewMode();
  const { timeZone } = useDateFormatContext();

  const pagerHeight = match(viewMode)
    .with('week', () => DATE_CELL_HEIGHT)
    .with('month', () => MONTH_WEEKS * DATE_CELL_HEIGHT)
    .exhaustive();

  const handlePrevious = () =>
    setSelectedDate(shiftCalendarDate(viewMode, selectedDate, -1, timeZone));
  const handleNext = () => setSelectedDate(shiftCalendarDate(viewMode, selectedDate, 1, timeZone));

  return (
    <VStack className="bg-white" gap={8}>
      {/* 좁은 pane·큰 글자에서는 보기 전환·이동 버튼을 다음 줄 오른쪽으로 내려 잘리지 않게 한다 */}
      <HStack className="flex-wrap gap-y-2 px-4 py-2" justify="between" align="center">
        <HStack gap={8} align="center" className="min-w-0 shrink">
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

        <HStack gap={8} align="center" className="ml-auto">
          <CalendarViewModeTabs />
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

function CalendarViewModeTabs() {
  const { t } = useTranslation('todo');
  const [viewMode, setViewMode] = useCalendarViewMode();

  return (
    <Tabs
      value={viewMode}
      onValueChange={(next) => setViewMode(calendarViewModeSchema.parse(next))}
    >
      <Tabs.List className="gap-0 rounded-lg bg-gray-2">
        <Tabs.Indicator className="rounded-md bg-white shadow-none" />
        <CalendarViewModeTrigger value="week">{t('calendar.week')}</CalendarViewModeTrigger>
        <CalendarViewModeTrigger value="month">{t('calendar.month')}</CalendarViewModeTrigger>
      </Tabs.List>
    </Tabs>
  );
}

function CalendarViewModeTrigger({
  value,
  children,
}: {
  value: CalendarViewMode;
  children: string;
}) {
  return (
    <Tabs.Trigger value={value} hitSlop={4} className="p-0">
      {({ isSelected }) => (
        // 저장된 보기로 앱을 켜면 Tabs.Indicator가 그려지지 않을 때가 있어 선택 배경을 칸에도 둔다
        <Box className={cn('h-[22px] justify-center rounded-md px-2.5', isSelected && 'bg-white')}>
          <Text size="e1" weight="medium" shade={isSelected ? 9 : 5}>
            {children}
          </Text>
        </Box>
      )}
    </Tabs.Trigger>
  );
}

function CalendarHeaderText() {
  const [viewMode] = useCalendarViewMode();
  const selectedDateKey = useFeedDateKey();
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();

  const headerText = match(viewMode)
    .with('week', () => formatWeekOfMonthLabel(selectedDateKey, todayDateKey, dateFormatContext))
    .with('month', () => formatDateKeyLabel(selectedDateKey, 'yearMonth', dateFormatContext))
    .exhaustive();

  return (
    <Text size="b1" weight="semibold" className="shrink">
      {headerText}
    </Text>
  );
}

interface CalendarWeekPagerProps {
  completions: CompletionsByDate;
}

function CalendarWeekPager({ completions }: CalendarWeekPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDateParam();
  const { timeZone } = useDateFormatContext();
  const baseWeekRef = useRef(getWeekStart(selectedDate, timeZone));

  const weekAtPage = useCallback(
    (page: number) =>
      dayjs(baseWeekRef.current)
        .add(page - CENTER_PAGE, 'week')
        .toDate(),
    [],
  );

  const pageOfWeek = useCallback(
    (week: Date) =>
      clampCalendarPage(diffWeeks(week, baseWeekRef.current, timeZone) + CENTER_PAGE, TOTAL_PAGES),
    [timeZone],
  );

  const handleChange = (page: number) => {
    const week = weekAtPage(page);
    setSelectedDate(dayjs(week).day(dayjs(selectedDate).day()).toDate());
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
  const [selectedDate, setSelectedDate] = useFeedDateParam();
  const baseMonthRef = useRef(dayjs(selectedDate).startOf('month').toDate());

  const monthAtPage = useCallback(
    (page: number) =>
      dayjs(baseMonthRef.current)
        .add(page - CENTER_PAGE, 'month')
        .toDate(),
    [],
  );

  const pageOfMonth = useCallback(
    (month: Date) =>
      clampCalendarPage(diffMonths(month, baseMonthRef.current) + CENTER_PAGE, TOTAL_PAGES),
    [],
  );

  const handleChange = (page: number) => {
    const month = monthAtPage(page);
    setSelectedDate(dayjs(month).date(dayjs(selectedDate).date()).toDate());
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
  children: (page: number) => ReactNode;
}

function CalendarPager({ data, value, onChange, children }: CalendarPagerProps) {
  // 측정 전 첫 프레임은 창 너비로 그려 달력 높이가 0에서 튀어나오지 않게 한다.
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

  // 시작 위치는 네이티브가 뷰를 만들 때 바로 적용하는 contentOffset으로 준다. initialScrollIndex만 두면
  // 목록이 콘텐츠 크기를 받은 뒤 JS가 scrollTo를 보내는데, 앱을 다시 열 때처럼 네이티브 contentSize가
  // 아직 0이면 그 명령이 0으로 잘려 260번째 주가 화면 밖에 그려지고 날짜 줄이 빈다.
  // 목록은 너비마다 새로 만들므로 이 값도 너비가 바뀔 때만 다시 계산한다.
  const initialContentOffset = useMemo(
    () => ({ x: currentPageRef.current * pageWidth, y: 0 }),
    [pageWidth],
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
        contentOffset={initialContentOffset}
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
  const { timeZone } = useDateFormatContext();
  const dates = getWeekDates(getWeekStart(week, timeZone));

  return (
    <HStack px={8}>
      {dates.map((date) => (
        <CalendarDateCell key={date.toISOString()} date={date}>
          <CompletionIndicator completion={completions[toDateKey(date, timeZone)]} />
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
  const { timeZone } = useDateFormatContext();
  const weeks = fillMonthGrid(getMonthWeeks(month, timeZone));

  return (
    <VStack>
      {weeks.map((week, weekIndex) => (
        // 주 순서는 고정되어 index가 안정적인 key다.
        <HStack key={weekIndex} px={8}>
          {week.map((date) => (
            <CalendarDateCell
              key={date.toISOString()}
              date={date}
              className={isSameMonth(date, month, timeZone) ? undefined : 'opacity-20'}
            >
              <CompletionIndicator completion={completions[toDateKey(date, timeZone)]} />
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
    filled.push(getWeekDates(dayjs(lastDate).add(1, 'day').toDate()));
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

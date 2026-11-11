import { ANIMATION } from '@src/shared/constants/animation';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import { getDayOfWeek, isSameMonthDateKey } from '@src/shared/date/date-key';
import { type DateFormatContext, formatDateLabel } from '@src/shared/date/format/date-format';
import { toLocalDay } from '@src/shared/date/native-date';
import {
  addLocalDays,
  addLocalMonths,
  diffLocalMonths,
  moveToLocalMonth,
  startOfLocalMonth,
  toDateKey,
} from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Box, HStack, usePaneColumns, VStack, QueryErrorFallback } from '@src/shared/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

import { useFeedDate } from '../../hooks/use-feed-params';
import type { CompletionsByDate } from '../../queries/todo.queries';
import { calendarViewModeStoredValue } from '../../schemas/calendar-view-mode-storage.schema';
import { getMonthViewDayState } from '../../utils/calendar-day';
import { diffWeeks, getMonthWeeks, getWeekDates, getWeekStart } from '../../utils/calendar-grid';
import { clampCalendarPage } from '../../utils/calendar-pager.geometry';
import { CALENDAR_DATE_CELL_HEIGHT, CalendarDateCell } from './calendar-date-cell';
import { CalendarHeader } from './calendar-header';
import { CALENDAR_CENTER_PAGE, CALENDAR_TOTAL_PAGES, CalendarPager } from './calendar-pager';
import { CalendarWeekdayHeader } from './calendar-weekday-header';

const EMPTY_COMPLETIONS: CompletionsByDate = {};
const MONTH_WEEKS = 6;
const PAGER_HEIGHT_TIMING = {
  duration: ANIMATION.duration.normal,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

interface CalendarProps {
  completions?: CompletionsByDate;
  status?: ReactNode;
}

export function Calendar({ completions = EMPTY_COMPLETIONS, status }: CalendarProps) {
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const [pageWidth, handlePagerLayout] = useCalendarPageWidth();

  const pagerHeight = match(viewMode)
    .with('week', () => CALENDAR_DATE_CELL_HEIGHT)
    .with('month', () => MONTH_WEEKS * CALENDAR_DATE_CELL_HEIGHT)
    .exhaustive();

  return (
    <VStack className="bg-white" gap={8}>
      <CalendarHeader />

      <CalendarWeekdayHeader />

      <CalendarHeightTransition height={pagerHeight}>
        {/* 높이가 바뀌는 바깥이 아니라 내용에서 재어 애니메이션 동안 layout 이벤트가 이어지지 않는다 */}
        <Box onLayout={handlePagerLayout}>
          {match(viewMode)
            .with('week', () => (
              <CalendarWeekPager pageWidth={pageWidth} completions={completions} />
            ))
            .with('month', () => (
              <CalendarMonthPager pageWidth={pageWidth} completions={completions} />
            ))
            .exhaustive()}
        </Box>
      </CalendarHeightTransition>
      {status != null && <Box px={16}>{status}</Box>}
    </VStack>
  );
}

/** 주·월을 바꿔도 다시 재지 않도록 달력이 쪽 너비를 잰다. 재기 전에는 목록 pane 폭으로 어림해 첫 프레임부터 7칸이 맞는다 */
function useCalendarPageWidth() {
  const { primaryWidth } = usePaneColumns();
  const insets = useSafeAreaInsets();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  return [measuredWidth ?? primaryWidth - insets.left - insets.right, handleLayout] as const;
}

interface CalendarHeightTransitionProps {
  height: number;
  children: ReactNode;
}

/** 주↔월 높이를 UI 스레드에서 이어 바꿔 아래 피드가 한 프레임에 밀리지 않게 한다. 동작 줄이기면 바로 바뀐다 */
function CalendarHeightTransition({ height, children }: CalendarHeightTransitionProps) {
  const animatedHeight = useSharedValue(height);

  useEffect(() => {
    animatedHeight.set(withTiming(height, PAGER_HEIGHT_TIMING));
  }, [height, animatedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({ height: animatedHeight.get() }));

  return <Animated.View style={[{ overflow: 'hidden' }, animatedStyle]}>{children}</Animated.View>;
}

interface CalendarWeekPagerProps {
  pageWidth: number;
  completions: CompletionsByDate;
}

function CalendarWeekPager({ pageWidth, completions }: CalendarWeekPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const { timeZone } = useDateFormatContext();
  // 처음 연 날의 주를 가운데 쪽으로 고정한다. 이후 날짜를 골라도 바뀌지 않는다
  const [baseWeek] = useState(() => getWeekStart(selectedDate, timeZone));

  const getWeekAtPage = useCallback(
    (page: number) =>
      addLocalDays(baseWeek, (page - CALENDAR_CENTER_PAGE) * DAYS_PER_WEEK, timeZone),
    [baseWeek, timeZone],
  );

  const getWeekPage = useCallback(
    (week: Date) =>
      clampCalendarPage(
        diffWeeks(week, baseWeek, timeZone) + CALENDAR_CENTER_PAGE,
        CALENDAR_TOTAL_PAGES,
      ),
    [baseWeek, timeZone],
  );

  const handleChange = (page: number) => {
    const week = getWeekAtPage(page);
    setSelectedDate(addLocalDays(week, getDayOfWeek(toDateKey(selectedDate, timeZone)), timeZone));
  };

  return (
    <CalendarPager value={getWeekPage(selectedDate)} pageWidth={pageWidth} onChange={handleChange}>
      {(page) => (
        <WeekRow weekKey={toDateKey(getWeekAtPage(page), timeZone)} completions={completions} />
      )}
    </CalendarPager>
  );
}

interface CalendarMonthPagerProps {
  pageWidth: number;
  completions: CompletionsByDate;
}

function CalendarMonthPager({ pageWidth, completions }: CalendarMonthPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const { timeZone } = useDateFormatContext();
  // 처음 연 날의 달을 가운데 쪽으로 고정한다. 이후 날짜를 골라도 바뀌지 않는다
  const [baseMonth] = useState(() => startOfLocalMonth(selectedDate, timeZone));

  const getMonthAtPage = useCallback(
    (page: number) => addLocalMonths(baseMonth, page - CALENDAR_CENTER_PAGE, timeZone),
    [baseMonth, timeZone],
  );

  const getMonthPage = useCallback(
    (month: Date) =>
      clampCalendarPage(
        diffLocalMonths(month, baseMonth, timeZone) + CALENDAR_CENTER_PAGE,
        CALENDAR_TOTAL_PAGES,
      ),
    [baseMonth, timeZone],
  );

  const handleChange = (page: number) => {
    const month = getMonthAtPage(page);
    setSelectedDate(moveToLocalMonth(selectedDate, month, timeZone));
  };

  return (
    <CalendarPager value={getMonthPage(selectedDate)} pageWidth={pageWidth} onChange={handleChange}>
      {(page) => (
        <MonthGrid monthKey={toDateKey(getMonthAtPage(page), timeZone)} completions={completions} />
      )}
    </CalendarPager>
  );
}

interface WeekRowProps {
  /** 날짜 키로 받아, 목록이 쪽을 다시 그려도 같은 주면 칸의 Date가 그대로라 memo가 맞는다 */
  weekKey: string;
  completions: CompletionsByDate;
}

function WeekRow({ weekKey, completions }: WeekRowProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const { timeZone } = dateFormatContext;
  // 컴파일러는 이 결과를 아래 JSX와 한 캐시로 묶어 날짜를 고를 때마다 칸 Date를 새로 만든다. 칸 memo가 맞게 따로 둔다
  const days = useMemo(
    () =>
      getWeekDates(
        getWeekStart(toLocalDay(weekKey), dateFormatContext.timeZone),
        dateFormatContext.timeZone,
      ).map((date) => toCalendarDay(date, dateFormatContext)),
    [weekKey, dateFormatContext],
  );
  const selectedDateKey = toDateKey(selectedDate, timeZone);

  return (
    <HStack px={8}>
      {days.map(({ date, dateKey, label }) => (
        <CalendarDateCell
          key={dateKey}
          date={date}
          label={label}
          {...getMonthViewDayState({ dateKey, selectedDateKey, todayKey })}
          isOutsideMonth={false}
          completion={completions[dateKey]}
          onSelect={setSelectedDate}
        />
      ))}
    </HStack>
  );
}

interface MonthGridProps {
  /** 날짜 키로 받는 이유는 `WeekRowProps.weekKey`와 같다 */
  monthKey: string;
  completions: CompletionsByDate;
}

function MonthGrid({ monthKey, completions }: MonthGridProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const { timeZone } = dateFormatContext;
  // 따로 두는 이유는 WeekRow의 days와 같다
  const weeks = useMemo(
    () =>
      fillMonthGrid(
        getMonthWeeks(toLocalDay(monthKey), dateFormatContext.timeZone),
        dateFormatContext.timeZone,
      ).map((week) => week.map((date) => toCalendarDay(date, dateFormatContext))),
    [monthKey, dateFormatContext],
  );
  const selectedDateKey = toDateKey(selectedDate, timeZone);

  return (
    <VStack>
      {weeks.map((week, weekIndex) => (
        // 주 순서는 고정되어 index가 안정적인 key다.
        <HStack key={weekIndex} px={8}>
          {week.map(({ date, dateKey, label }) => (
            <CalendarDateCell
              key={dateKey}
              date={date}
              label={label}
              {...getMonthViewDayState({ dateKey, selectedDateKey, todayKey })}
              isOutsideMonth={!isSameMonthDateKey(dateKey, monthKey)}
              completion={completions[dateKey]}
              onSelect={setSelectedDate}
            />
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  label: string;
}

/** 날짜 키와 읽어 줄 글자는 쪽을 그릴 때 한 번 만들고, 선택이 바뀌어도 다시 만들지 않는다 */
function toCalendarDay(date: Date, dateFormatContext: DateFormatContext): CalendarDay {
  return {
    date,
    dateKey: toDateKey(date, dateFormatContext.timeZone),
    label: formatDateLabel(date, 'fullDate', dateFormatContext),
  };
}

function fillMonthGrid(weeks: Date[][], timeZone: string): Date[][] {
  const filled = [...weeks];
  while (filled.length < MONTH_WEEKS) {
    const lastWeek = filled.at(-1);
    const lastDate = lastWeek?.[DAYS_PER_WEEK - 1];
    if (!lastDate) {
      break;
    }
    filled.push(getWeekDates(addLocalDays(lastDate, 1, timeZone), timeZone));
  }

  return filled;
}

Calendar.Error = function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <QueryErrorFallback.Inline
      message={t('todo:calendar.loadFailed')}
      messageProps={{ size: 'e1' }}
      reset={onRetry}
      py={4}
    />
  );
};

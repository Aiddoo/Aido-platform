import { ANIMATION } from '@src/shared/constants/animation';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInCalendarWeeks,
  diffDateKeysInMonths,
  getCalendarWeek,
  getDayOfWeek,
  getMonthStartDateKey,
  type DateKey,
} from '@src/shared/date/date-key';
import { getDaysSinceCalendarWeekStart } from '@src/shared/date/week-start';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import {
  Box,
  FishIcon,
  HStack,
  QueryErrorFallback,
  Text,
  usePaneColumns,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo, type ReactNode, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

import type { DailyCompletionSummary } from '../../domains/daily-completion.model';
import { useFeedDateKey } from '../../hooks/use-feed-params';
import type { CompletionsByDate } from '../../queries/todo.queries';
import { calendarViewModeStoredValue } from '../../schemas/calendar-view-mode-storage.schema';
import {
  type CalendarDayType,
  DAY_TYPE_TONE,
  getMonthViewDayState,
} from '../../utils/calendar-day.view-model';
import {
  type CalendarDayCell,
  FEED_MONTH_WEEK_COUNT,
  getFeedMonthWeeks,
  getFeedWeekCells,
} from '../../utils/calendar-month.view-model';
import { clampCalendarPage } from '../../utils/calendar-pager.geometry';
import { CALENDAR_CENTER_PAGE, CALENDAR_TOTAL_PAGES, CalendarPager } from './calendar-pager';
import { CalendarTitleBar } from './calendar-title-bar';
import { WeekdayRow } from './weekday-row';

const CALENDAR_DATE_CELL_HEIGHT = 56;
const MAX_CATEGORY_INDICATOR_COUNT = 3;
const EMPTY_COMPLETIONS: CompletionsByDate = {};
const PAGER_HEIGHT_TIMING = {
  duration: ANIMATION.durationMs.normal,
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
    .with('month', () => FEED_MONTH_WEEK_COUNT * CALENDAR_DATE_CELL_HEIGHT)
    .exhaustive();

  return (
    <VStack className="bg-white" gap={8}>
      <CalendarTitleBar />

      <WeekdayRow />

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

Calendar.Error = function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <QueryErrorFallback.Inline
      message={t('todo:calendar.loadFailed')}
      messageProps={{ size: 'e1' }}
      reset={onRetry}
      className="py-1"
    />
  );
};

/** 주·월을 바꿔도 다시 재지 않도록 달력이 쪽 너비를 잰다. 재기 전에는 목록 pane 폭으로 어림해 첫 프레임부터 7칸이 맞는다 */
function useCalendarPageWidth() {
  const { primaryWidth } = usePaneColumns();
  const insets = useSafeAreaInsets();
  const [measuredSize, handleLayout] = useLayoutSize();
  const measuredWidth = measuredSize?.width;

  // 창을 끌거나 사이드바를 여닫는 동안 폭이 연달아 바뀐다. 쪽 목록은 폭마다 새로 만들어 무거워 다른 그리기를 막지 않게 미룬다
  const pageWidth = useDeferredValue(measuredWidth ?? primaryWidth - insets.left - insets.right);

  return [pageWidth, handleLayout] as const;
}

interface CalendarHeightTransitionProps {
  height: number;
  children: ReactNode;
}

// 주↔월 높이를 UI 스레드에서 이어 바꿔 아래 피드가 한 프레임에 밀리지 않게 한다. 아래 피드가 따라와야 해 transform 대신
// 높이를 움직이는 모션 규칙의 예외다(ui.md 모션). 동작 줄이기면 바로 바뀐다
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
  const [selectedDateKey, setSelectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  // 처음 연 날의 주를 가운데 쪽으로 고정한다. 이후 날짜를 골라도 바뀌지 않는다
  const [baseWeekKey] = useState(() => getCalendarWeek(selectedDateKey).startDateKey);

  const getWeekKeyAtPage = (page: number) =>
    addDaysToDateKey(baseWeekKey, (page - CALENDAR_CENTER_PAGE) * DAYS_PER_WEEK);

  const handleChange = (page: number) => {
    setSelectedDateKey(
      addDaysToDateKey(
        getWeekKeyAtPage(page),
        getDaysSinceCalendarWeekStart(getDayOfWeek(selectedDateKey)),
      ),
    );
  };

  return (
    <CalendarPager
      value={clampCalendarPage(
        diffDateKeysInCalendarWeeks(baseWeekKey, selectedDateKey) + CALENDAR_CENTER_PAGE,
        CALENDAR_TOTAL_PAGES,
      )}
      pageWidth={pageWidth}
      onChange={handleChange}
    >
      {(page) => (
        <WeekRow
          weekKey={getWeekKeyAtPage(page)}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          completions={completions}
          onSelect={setSelectedDateKey}
        />
      )}
    </CalendarPager>
  );
}

interface CalendarMonthPagerProps {
  pageWidth: number;
  completions: CompletionsByDate;
}

function CalendarMonthPager({ pageWidth, completions }: CalendarMonthPagerProps) {
  const [selectedDateKey, setSelectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  // 처음 연 날의 달을 가운데 쪽으로 고정한다. 이후 날짜를 골라도 바뀌지 않는다
  const [baseMonthKey] = useState(() => getMonthStartDateKey(selectedDateKey));

  const getMonthKeyAtPage = (page: number) =>
    addMonthsToDateKey(baseMonthKey, page - CALENDAR_CENTER_PAGE);

  // 달만 옮기고 일은 고른 날의 일을 쓴다. 그 달에 없는 일은 마지막 날이다
  const handleChange = (page: number) => {
    setSelectedDateKey(
      addMonthsToDateKey(
        selectedDateKey,
        diffDateKeysInMonths(selectedDateKey, getMonthKeyAtPage(page)),
      ),
    );
  };

  return (
    <CalendarPager
      value={clampCalendarPage(
        diffDateKeysInMonths(baseMonthKey, selectedDateKey) + CALENDAR_CENTER_PAGE,
        CALENDAR_TOTAL_PAGES,
      )}
      pageWidth={pageWidth}
      onChange={handleChange}
    >
      {(page) => (
        <MonthGrid
          monthKey={getMonthKeyAtPage(page)}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          completions={completions}
          onSelect={setSelectedDateKey}
        />
      )}
    </CalendarPager>
  );
}

interface CalendarPageProps {
  selectedDateKey: DateKey;
  todayKey: DateKey;
  completions: CompletionsByDate;
  onSelect: (dateKey: DateKey) => void;
}

interface WeekRowProps extends CalendarPageProps {
  weekKey: DateKey;
}

function WeekRow({ weekKey, selectedDateKey, todayKey, completions, onSelect }: WeekRowProps) {
  const { locale, timezone } = useDateFormatContext();
  // 주·언어가 같으면 칸 글자와 요일을 다시 만들지 않는다. 날짜를 골라도 Intl을 부르지 않는다
  const days = useMemo(
    () => getFeedWeekCells(weekKey, { locale, timezone }),
    [weekKey, locale, timezone],
  );

  return (
    <HStack px={8}>
      {days.map((day) => (
        <CalendarDay
          key={day.dateKey}
          day={day}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          completions={completions}
          onSelect={onSelect}
        />
      ))}
    </HStack>
  );
}

interface MonthGridProps extends CalendarPageProps {
  monthKey: DateKey;
}

function MonthGrid({ monthKey, selectedDateKey, todayKey, completions, onSelect }: MonthGridProps) {
  const { locale, timezone } = useDateFormatContext();
  // 다시 만들지 않는 이유는 WeekRow의 days와 같다
  const weeks = useMemo(
    () => getFeedMonthWeeks(monthKey, { locale, timezone }),
    [monthKey, locale, timezone],
  );

  return (
    <VStack>
      {weeks.map((week, weekIndex) => (
        // 주 순서는 고정되어 index가 안정적인 key다.
        <HStack key={weekIndex} px={8}>
          {week.map((day) => (
            <CalendarDay
              key={day.dateKey}
              day={day}
              selectedDateKey={selectedDateKey}
              todayKey={todayKey}
              completions={completions}
              onSelect={onSelect}
            />
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

interface CalendarDayProps extends CalendarPageProps {
  day: CalendarDayCell;
}

/** 쪽에서 미리 구한 칸 값과 선택·오늘을 메모된 칸의 파생 값으로 바꾼다 */
function CalendarDay({ day, selectedDateKey, todayKey, completions, onSelect }: CalendarDayProps) {
  const { dateKey, dayNumber, label, dayOfWeek, isOutsideMonth } = day;

  return (
    <CalendarDateCell
      dateKey={dateKey}
      dayNumber={dayNumber}
      label={label}
      {...getMonthViewDayState({ dateKey, dayOfWeek, selectedDateKey, todayKey })}
      isOutsideMonth={isOutsideMonth}
      completion={completions[dateKey]}
      onSelect={onSelect}
    />
  );
}

interface CalendarDateCellProps {
  dateKey: DateKey;
  dayNumber: string;
  /** 읽어 줄 날짜. 쪽마다 한 번 만들어 칸이 다시 그려질 때 Intl을 부르지 않는다 */
  label: string;
  isSelected: boolean;
  dayType: CalendarDayType;
  isTodayHighlighted: boolean;
  isOutsideMonth: boolean;
  completion: DailyCompletionSummary | undefined;
  onSelect: (dateKey: DateKey) => void;
}

/** 칸이 많아 pager가 route를 한 번 읽고 파생 값만 넘긴다. 날짜를 바꾸면 선택이 바뀐 칸만 다시 그린다 */
const CalendarDateCell = memo(function CalendarDateCell({
  dateKey,
  dayNumber,
  label,
  isSelected,
  dayType,
  isTodayHighlighted,
  isOutsideMonth,
  completion,
  onSelect,
}: CalendarDateCellProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(dateKey)}
      style={{ height: CALENDAR_DATE_CELL_HEIGHT }}
      className={cn('flex-1 items-center justify-between py-1', isOutsideMonth && 'opacity-20')}
    >
      <Box
        className={cn(
          'size-7.5 items-center justify-center overflow-hidden rounded-2xl',
          isSelected && 'bg-main',
          isTodayHighlighted && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text size="b4" weight="medium" tone={DAY_TYPE_TONE[dayType]} shade={7}>
          {dayNumber}
        </Text>
      </Box>
      <Box className="h-3 items-center justify-center">
        <CompletionIndicator completion={completion} />
      </Box>
    </PressableFeedback>
  );
});

interface CompletionIndicatorProps {
  completion: DailyCompletionSummary | undefined;
}

function CompletionIndicator({ completion }: CompletionIndicatorProps) {
  if (completion == null) {
    return null;
  }
  if (completion.isComplete) {
    return <FishIcon width={16} height={12} colorClassName="text-fish" />;
  }
  if (completion.totalTodos > 0) {
    return <CategoryIndicator colors={completion.categoryColors} />;
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
        className={cn('size-1.5 rounded-2xl', firstColor == null && 'bg-gray-5')}
        style={firstColor == null ? undefined : { backgroundColor: firstColor }}
      />
    );
  }

  return (
    <HStack className="h-1.5 w-4 overflow-hidden rounded-2xl">
      {colors.slice(0, MAX_CATEGORY_INDICATOR_COUNT).map((color) => (
        <Box key={color} style={{ backgroundColor: color }} className="flex-1" />
      ))}
    </HStack>
  );
}

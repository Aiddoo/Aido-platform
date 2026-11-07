import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import { formatDateKeyLabel } from '@src/shared/date/date-format';
import { getDayOfWeek } from '@src/shared/date/date-key';
import { formatWeekOfMonthLabel } from '@src/shared/date/date-labels';
import { toDateKey } from '@src/shared/date/instant';
import {
  addLocalDays,
  addLocalMonths,
  diffLocalMonths,
  startOfLocalMonth,
  moveToLocalMonth,
} from '@src/shared/date/local-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday, useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, FishIcon, HStack, Result, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Tabs } from 'heroui-native';
import { type ReactNode, useCallback, useRef } from 'react';
import { match } from 'ts-pattern';

import { useCalendarViewMode } from '../../hooks/use-calendar-view-mode';
import { useFeedDate, useFeedDateKey } from '../../hooks/use-feed-params';
import type { CompletionsByDate } from '../../queries/todo.queries';
import {
  type CalendarViewMode,
  calendarViewModeSchema,
} from '../../schemas/calendar-view-mode.schema';
import type { DailyCompletionSummary } from '../../schemas/todo.schema';
import { isSameMonth } from '../../utils/calendar-day-comparison';
import {
  diffWeeks,
  getMonthWeeks,
  getWeekDates,
  getWeekStart,
  shiftCalendarDate,
} from '../../utils/calendar-grid';
import { clampCalendarPage } from '../../utils/calendar-pager.geometry';
import { CalendarDateCell } from './calendar-date-cell';
import { CalendarNavigation } from './calendar-navigation';
import { CALENDAR_CENTER_PAGE, CALENDAR_TOTAL_PAGES, CalendarPager } from './calendar-pager';
import { CalendarWeekdayHeader } from './calendar-weekday-header';

const EMPTY_COMPLETIONS: CompletionsByDate = {};
const DATE_CELL_HEIGHT = 56;
const MONTH_WEEKS = 6;

interface CalendarProps {
  completions?: CompletionsByDate;
  status?: ReactNode;
}

export function Calendar({ completions = EMPTY_COMPLETIONS, status }: CalendarProps) {
  const { t } = useTranslation('common');
  const [selectedDate, setSelectedDate] = useFeedDate();
  const today = useToday();
  const [viewMode] = useCalendarViewMode();
  const { timeZone } = useDateFormatContext();

  const pagerHeight = match(viewMode)
    .with('week', () => DATE_CELL_HEIGHT)
    .with('month', () => MONTH_WEEKS * DATE_CELL_HEIGHT)
    .exhaustive();

  const handlePrevious = () =>
    setSelectedDate(shiftCalendarDate({ viewMode, date: selectedDate, step: -1, timeZone }));
  const handleNext = () =>
    setSelectedDate(shiftCalendarDate({ viewMode, date: selectedDate, step: 1, timeZone }));

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
  const [selectedDateKey] = useFeedDateKey();
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
  const [selectedDate, setSelectedDate] = useFeedDate();
  const { timeZone } = useDateFormatContext();
  const baseWeekRef = useRef(getWeekStart(selectedDate, timeZone));

  const weekAtPage = useCallback(
    (page: number) =>
      addLocalDays(baseWeekRef.current, (page - CALENDAR_CENTER_PAGE) * DAYS_PER_WEEK, timeZone),
    [timeZone],
  );

  const pageOfWeek = useCallback(
    (week: Date) =>
      clampCalendarPage(
        diffWeeks(week, baseWeekRef.current, timeZone) + CALENDAR_CENTER_PAGE,
        CALENDAR_TOTAL_PAGES,
      ),
    [timeZone],
  );

  const handleChange = (page: number) => {
    const week = weekAtPage(page);
    setSelectedDate(addLocalDays(week, getDayOfWeek(toDateKey(selectedDate, timeZone)), timeZone));
  };

  return (
    <CalendarPager value={pageOfWeek(selectedDate)} onChange={handleChange}>
      {(page) => <WeekRow week={weekAtPage(page)} completions={completions} />}
    </CalendarPager>
  );
}

interface CalendarMonthPagerProps {
  completions: CompletionsByDate;
}

function CalendarMonthPager({ completions }: CalendarMonthPagerProps) {
  const [selectedDate, setSelectedDate] = useFeedDate();
  const { timeZone } = useDateFormatContext();
  const baseMonthRef = useRef(startOfLocalMonth(selectedDate, timeZone));

  const monthAtPage = useCallback(
    (page: number) => addLocalMonths(baseMonthRef.current, page - CALENDAR_CENTER_PAGE, timeZone),
    [timeZone],
  );

  const pageOfMonth = useCallback(
    (month: Date) =>
      clampCalendarPage(
        diffLocalMonths(month, baseMonthRef.current, timeZone) + CALENDAR_CENTER_PAGE,
        CALENDAR_TOTAL_PAGES,
      ),
    [timeZone],
  );

  const handleChange = (page: number) => {
    const month = monthAtPage(page);
    setSelectedDate(moveToLocalMonth(selectedDate, month, timeZone));
  };

  return (
    <CalendarPager value={pageOfMonth(selectedDate)} onChange={handleChange}>
      {(page) => <MonthGrid month={monthAtPage(page)} completions={completions} />}
    </CalendarPager>
  );
}

interface WeekRowProps {
  week: Date;
  completions: CompletionsByDate;
}

function WeekRow({ week, completions }: WeekRowProps) {
  const { timeZone } = useDateFormatContext();
  const dates = getWeekDates(getWeekStart(week, timeZone), timeZone);

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
  const weeks = fillMonthGrid(getMonthWeeks(month, timeZone), timeZone);

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

function fillMonthGrid(weeks: Date[][], timeZone: string): Date[][] {
  const filled = [...weeks];
  while (filled.length < MONTH_WEEKS) {
    const lastWeek = filled.at(-1);
    const lastDate = lastWeek?.[6];
    if (!lastDate) {
      break;
    }
    filled.push(getWeekDates(addLocalDays(lastDate, 1, timeZone), timeZone));
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

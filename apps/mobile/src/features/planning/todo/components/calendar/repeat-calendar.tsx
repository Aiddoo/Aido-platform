import { formatDateLabel } from '@src/shared/date/format/date-format';
import { toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { memo } from 'react';
import { match } from 'ts-pattern';

import { PICKER_DATE_CELL_HEIGHT, PICKER_MONTH_HEIGHT } from '../../constants/todo.constants';
import type { DatePicker } from '../../hooks/use-date-picker';
import {
  DAY_TYPE_TONE,
  getDatePickerDayType,
  getRepeatWeekDays,
  getWeekRangeBand,
  isTodayHighlighted,
} from '../../utils/calendar-day';
import { isBeforeDay } from '../../utils/calendar-day-comparison';
import { PickerMonthHeader } from '../picker-month-header';
import { CalendarWeekdayHeader } from './calendar-weekday-header';

interface RepeatCalendarProps {
  picker: DatePicker;
  today: Date;
  startDate: Date;
  endDate: Date | null;
  isOpenEnded: boolean;
  /** 띠 안에서 실제로 반복되는 날(YYYY-MM-DD). null이면 흐리게 하지 않는다 */
  occurrenceKeys: ReadonlySet<string> | null;
  onValueChange: (date: Date) => void;
}

export function RepeatCalendar({
  picker,
  today,
  startDate,
  endDate,
  isOpenEnded,
  occurrenceKeys,
  onValueChange,
}: RepeatCalendarProps) {
  const { displayMonth, weeks, goToPrevMonth, goToNextMonth } = picker;
  const { timeZone } = useDateFormatContext();

  return (
    <VStack gap={16}>
      <PickerMonthHeader
        displayMonth={displayMonth}
        onPreviousMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
      />

      <CalendarWeekdayHeader />

      <VStack style={{ height: PICKER_MONTH_HEIGHT }}>
        {weeks.map((week, weekIndex) => {
          const days = getRepeatWeekDays(week, {
            displayMonth,
            startDate,
            endDate,
            isOpenEnded,
            timeZone,
          });
          const band = getWeekRangeBand(days);

          return (
            // 주 순서는 고정되어 index가 안정적인 key다.
            <Box key={weekIndex} px={8}>
              <HStack className="relative">
                {/* 칸마다 나눠 그리면 폭이 소수점인 칸 경계에 세로선이 생겨 한 주에 띠 하나로 그린다 */}
                {band != null && (
                  <Box
                    className="absolute top-[8px] h-[32px] bg-main/8"
                    style={{
                      left: `${band.startRatio * 100}%`,
                      right: `${(1 - band.endRatio) * 100}%`,
                    }}
                  />
                )}
                {days.map(({ date, isVisible, isStart, isEnd, isInRange }) =>
                  isVisible ? (
                    <RepeatDateCell
                      key={date.toISOString()}
                      date={date}
                      today={today}
                      isStart={isStart}
                      isEnd={isEnd}
                      isDimmed={
                        occurrenceKeys != null &&
                        isInRange &&
                        !occurrenceKeys.has(toDateKey(date, timeZone))
                      }
                      onPress={onValueChange}
                    />
                  ) : (
                    <Box
                      key={date.toISOString()}
                      className="flex-1"
                      style={{ height: PICKER_DATE_CELL_HEIGHT }}
                    />
                  ),
                )}
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </VStack>
  );
}

interface RepeatDateCellProps {
  date: Date;
  today: Date;
  isStart: boolean;
  isEnd: boolean;
  isDimmed: boolean;
  onPress: (date: Date) => void;
}

/** 달력은 칸이 많아 입력 하나로 전부 다시 그리지 않도록 값이 바뀐 칸만 그린다 */
const RepeatDateCell = memo(function RepeatDateCell({
  date,
  today,
  isStart,
  isEnd,
  isDimmed,
  onPress,
}: RepeatDateCellProps) {
  const dayOfMonth = date.getDate();
  const dateFormatContext = useDateFormatContext();
  const { timeZone } = dateFormatContext;
  const isDisabled = isBeforeDay(date, today, timeZone);
  const isSelected = isStart || isEnd;
  const dayType = getDatePickerDayType({ date, isSelected, today, timeZone });
  const shouldHighlightToday =
    !isDisabled && isTodayHighlighted({ date, isSelected, today, timeZone });

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={formatDateLabel(date, 'fullDate', dateFormatContext)}
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      onPress={() => onPress(date)}
      style={{ height: PICKER_DATE_CELL_HEIGHT }}
      isDisabled={isDisabled}
      className={cn('relative flex-1 items-center justify-center', isDisabled && 'opacity-30')}
    >
      <Box
        className={cn(
          'z-10 size-8 items-center justify-center rounded-[16px]',
          isSelected && 'bg-main',
          shouldHighlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text
          size="b3"
          weight="medium"
          tone={isDisabled || isDimmed ? 'neutral' : DAY_TYPE_TONE[dayType]}
          shade={match({ isSelected, isDimmed })
            .with({ isSelected: true }, () => undefined)
            .with({ isDimmed: true }, () => 5 as const)
            .otherwise(() => 7 as const)}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
});

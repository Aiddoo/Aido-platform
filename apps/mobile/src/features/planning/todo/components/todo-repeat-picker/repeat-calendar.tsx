import type { DateKey } from '@src/shared/date/date-key';
import { Box, HStack, VStack } from '@src/shared/ui';

import { PICKER_MONTH_HEIGHT } from '../../constants/todo.constants';
import type { DatePicker } from '../../hooks/use-date-picker';
import {
  getPickerDayType,
  getRepeatWeekDays,
  getWeekRangeBand,
} from '../../utils/calendar-day.view-model';
import { WeekdayRow } from '../calendar/weekday-row';
import { PickerDateCell } from '../picker-date-cell';
import { PickerMonthBar } from '../picker-month-bar';

interface RepeatCalendarProps {
  picker: DatePicker;
  todayKey: DateKey;
  startDateKey: DateKey;
  endDateKey: DateKey | null;
  isOpenEnded: boolean;
  /** 띠 안에서 실제로 반복되는 날(YYYY-MM-DD). null이면 흐리게 하지 않는다 */
  occurrenceKeys: ReadonlySet<string> | null;
  onValueChange: (dateKey: DateKey) => void;
}

export function RepeatCalendar({
  picker,
  todayKey,
  startDateKey,
  endDateKey,
  isOpenEnded,
  occurrenceKeys,
  onValueChange,
}: RepeatCalendarProps) {
  const { displayMonthKey, weeks, goToPrevMonth, goToNextMonth } = picker;

  return (
    <VStack gap={16}>
      <PickerMonthBar
        displayMonthKey={displayMonthKey}
        onPreviousMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
      />

      <WeekdayRow />

      <VStack style={{ height: PICKER_MONTH_HEIGHT }}>
        {weeks.map((week, weekIndex) => {
          const days = getRepeatWeekDays(week, { startDateKey, endDateKey, isOpenEnded });
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
                {days.map(({ cell, isVisible, isStart, isEnd, isInRange }) => {
                  if (!isVisible) {
                    return <PickerDateCell.Placeholder key={cell.dateKey} />;
                  }
                  const isSelected = isStart || isEnd;
                  const isToday = cell.dateKey === todayKey;

                  return (
                    <PickerDateCell
                      key={cell.dateKey}
                      dateKey={cell.dateKey}
                      dayNumber={cell.dayNumber}
                      label={cell.label}
                      dayType={getPickerDayType({
                        dayOfWeek: cell.dayOfWeek,
                        isSelected,
                        isToday,
                      })}
                      isSelected={isSelected}
                      isTodayHighlighted={!isSelected && isToday}
                      isDisabled={cell.dateKey < todayKey}
                      isDimmed={
                        occurrenceKeys != null && isInRange && !occurrenceKeys.has(cell.dateKey)
                      }
                      onPress={onValueChange}
                    />
                  );
                })}
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </VStack>
  );
}

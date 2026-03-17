import type { DayOfWeek } from '@aido/validators';
import { ArrowLeftIcon, ArrowRightIcon, Box, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  formatMonthDay,
  getMonthHeaderText,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  isSameMonth,
} from '@src/shared/utils/date';
import { PressableFeedback } from 'heroui-native';
import { useDatePicker } from '../hooks/useDatePicker';
import { useRepeatSetting } from '../hooks/useRepeatSetting';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { getDayOfWeekFromDate } from '../utils/day-of-week';
import { CalendarWeekdayHeader } from './Calendar/CalendarWeekdayHeader';
import { PickerHeader } from './PickerHeader';
import { DayOfWeekSelector } from './TodoDatePickerContent';

interface RepeatResult {
  daysOfWeek: DayOfWeek[];
  repeatEndDate: Date | null;
}

interface TodoRepeatPickerContentProps {
  startDate: Date;
  repeat: RepeatResult;
  onConfirm: (repeat: RepeatResult) => void;
  onCancel: () => void;
}

const getInitialSelectedDays = (startDate: Date, daysOfWeek: DayOfWeek[]): DayOfWeek[] => {
  if (daysOfWeek.length > 0) return daysOfWeek;
  const dayOfWeek = getDayOfWeekFromDate(startDate);
  return dayOfWeek ? [dayOfWeek] : [];
};

const getDefaultEndDate = (startDate: Date, repeatEndDate: Date | null): Date => {
  if (repeatEndDate) return repeatEndDate;
  const defaultEnd = new Date(startDate);
  defaultEnd.setDate(defaultEnd.getDate() + 7);
  return defaultEnd;
};

export const TodoRepeatPickerContent = ({
  startDate,
  repeat,
  onConfirm,
  onCancel,
}: TodoRepeatPickerContentProps) => {
  const picker = useDatePicker({ startDate });
  const repeatSetting = useRepeatSetting({
    isEnabled: true,
    selectedDays: getInitialSelectedDays(startDate, repeat.daysOfWeek),
    endDate: getDefaultEndDate(startDate, repeat.repeatEndDate),
  });

  const handleConfirm = () => {
    onConfirm({
      daysOfWeek: repeatSetting.selectedDays,
      repeatEndDate: repeatSetting.endDate,
    });
  };

  const handleCalendarPress = (date: Date) => {
    if (isBeforeDay(date, startDate)) return;

    if (repeatSetting.endDate === null || !isSameDay(date, repeatSetting.endDate)) {
      repeatSetting.setEndDate(date);
    } else {
      repeatSetting.clearEndDate();
    }
  };

  return (
    <VStack gap={20}>
      <PickerHeader title="반복" onCancel={onCancel} onConfirm={handleConfirm} />

      <DayOfWeekSelector
        selectedDays={repeatSetting.selectedDays}
        onToggleDay={repeatSetting.toggleDay}
        onToggleAll={repeatSetting.toggleAllDays}
        isAllSelected={repeatSetting.isAllDaysSelected}
      />

      <RepeatCalendar
        picker={picker}
        startDate={startDate}
        endDate={repeatSetting.endDate}
        onDatePress={handleCalendarPress}
      />

      {repeatSetting.endDate && !isSameDay(startDate, repeatSetting.endDate) && (
        <VStack className="border-t border-gray-2 px-4 pt-3">
          <HStack gap={8} align="center">
            <Text size="b3" tone="neutral" shade={7}>
              반복 기간
            </Text>
            <Text size="b3" tone="neutral" shade={6}>
              •
            </Text>
            <Text size="b3" tone="brand">
              {formatMonthDay(startDate)} - {formatMonthDay(repeatSetting.endDate)}
            </Text>
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};

interface RepeatCalendarProps {
  picker: ReturnType<typeof useDatePicker>;
  startDate: Date;
  endDate: Date | null;
  onDatePress: (date: Date) => void;
}

const RepeatCalendar = ({ picker, startDate, endDate, onDatePress }: RepeatCalendarProps) => {
  const { displayMonth, weeks, goToPrevMonth, goToNextMonth } = picker;

  return (
    <VStack gap={16}>
      <HStack className="items-center justify-between" px={16}>
        <PressableFeedback onPress={goToPrevMonth} hitSlop={12}>
          <ArrowLeftIcon width={20} height={20} colorClassName="text-neutral-7" />
        </PressableFeedback>
        <Text size="b2" weight="semibold" tone="neutral" shade={9}>
          {getMonthHeaderText(displayMonth)}
        </Text>
        <PressableFeedback onPress={goToNextMonth} hitSlop={12}>
          <ArrowRightIcon width={20} height={20} colorClassName="text-neutral-7" />
        </PressableFeedback>
      </HStack>

      <CalendarWeekdayHeader />

      <VStack>
        {weeks.map((week, weekIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 주 순서가 변경되지 않음
          <HStack key={weekIndex} px={8}>
            {week.map((date) =>
              isSameMonth(date, displayMonth) ? (
                <RepeatDateCell
                  key={date.toISOString()}
                  date={date}
                  startDate={startDate}
                  endDate={endDate}
                  onPress={onDatePress}
                />
              ) : (
                <Box key={date.toISOString()} className="h-[48px] flex-1" />
              ),
            )}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
};

interface RepeatDateCellProps {
  date: Date;
  startDate: Date;
  endDate: Date | null;
  onPress: (date: Date) => void;
}

const RepeatDateCell = ({ date, startDate, endDate, onPress }: RepeatDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isStart = isSameDay(date, startDate);
  const isEnd = endDate !== null && isSameDay(date, endDate);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected });
  const highlightToday = isTodayHighlighted({ date, isSelected });

  const hasDistinctRange = endDate !== null && !isSameDay(startDate, endDate);
  const isInRange = hasDistinctRange && isAfterDay(date, startDate) && isBeforeDay(date, endDate);
  const isRangeStart = hasDistinctRange && isStart;
  const isRangeEnd = hasDistinctRange && isEnd;

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      className="relative h-[48px] flex-1 items-center justify-center"
    >
      {isRangeStart && <Box className="absolute right-0 top-[8px] h-[32px] w-1/2 bg-main/8" />}
      {isRangeEnd && <Box className="absolute left-0 top-[8px] h-[32px] w-1/2 bg-main/8" />}
      {isInRange && <Box className="absolute inset-x-0 top-[8px] h-[32px] bg-main/8" />}
      <Box
        className={cn(
          'z-10 size-8 items-center justify-center rounded-[16px]',
          isSelected && 'bg-main',
          highlightToday && 'bg-main/10 dark:bg-main/20',
        )}
      >
        <Text
          size="b3"
          weight="medium"
          tone={DAY_TYPE_TONE[dayStyle]}
          shade={isSelected ? undefined : 7}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
};

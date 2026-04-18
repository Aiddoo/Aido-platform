import type { DayOfWeek } from '@aido/validators';
import { ArrowLeftIcon, ArrowRightIcon, Box, Button, HStack, Text, VStack } from '@src/shared/ui';
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
import { useState } from 'react';
import { useDatePicker } from '../hooks/useDatePicker';
import { useRepeatSetting } from '../hooks/useRepeatSetting';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { getDayOfWeekFromDate, hasSelectedDayInRange } from '../utils/day-of-week';
import { CalendarWeekdayHeader } from './Calendar/CalendarWeekdayHeader';
import { PickerHeader } from './PickerHeader';
import { DayOfWeekSelector } from './TodoDatePickerContent';

interface RepeatInput {
  daysOfWeek: DayOfWeek[];
  repeatEndDate: Date | null;
}

interface RepeatConfirmResult extends RepeatInput {
  startDate: Date;
}

export type RepeatPickerCloseResult =
  | { type: 'confirm'; value: RepeatConfirmResult }
  | { type: 'reset' }
  | { type: 'cancel' };

interface TodoRepeatPickerContentProps {
  startDate: Date;
  repeat: RepeatInput;
  onClose: (result: RepeatPickerCloseResult) => void;
}

const getInitialSelectedDays = (startDate: Date, daysOfWeek: DayOfWeek[]): DayOfWeek[] => {
  if (daysOfWeek.length > 0) return daysOfWeek;
  const dayOfWeek = getDayOfWeekFromDate(startDate);
  return dayOfWeek ? [dayOfWeek] : [];
};

const getDefaultEndDate = (repeatEndDate: Date | null): Date | null => {
  return repeatEndDate;
};

export const TodoRepeatPickerContent = ({
  startDate: initialStartDate,
  repeat,
  onClose,
}: TodoRepeatPickerContentProps) => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const picker = useDatePicker({ startDate });
  const repeatSetting = useRepeatSetting({
    isEnabled: true,
    selectedDays: getInitialSelectedDays(initialStartDate, repeat.daysOfWeek),
    endDate: getDefaultEndDate(repeat.repeatEndDate),
  });

  const hasExistingRepeat = repeat.daysOfWeek.length > 0;
  const hasCompleteRange = repeatSetting.endDate !== null;

  const isConfirmDisabled =
    repeatSetting.selectedDays.length === 0 ||
    repeatSetting.endDate === null ||
    !hasSelectedDayInRange(startDate, repeatSetting.endDate, repeatSetting.selectedDays);

  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    onClose({
      type: 'confirm',
      value: {
        daysOfWeek: repeatSetting.selectedDays,
        repeatEndDate: repeatSetting.endDate,
        startDate,
      },
    });
  };

  const [today] = useState(() => new Date());

  const handleCalendarPress = (date: Date) => {
    if (isBeforeDay(date, today)) return;

    if (!hasCompleteRange) {
      if (isAfterDay(date, startDate)) {
        repeatSetting.setEndDate(date);
      } else if (isBeforeDay(date, startDate)) {
        setStartDate(date);
      }
      return;
    }

    setStartDate(date);
    repeatSetting.clearEndDate();
  };

  return (
    <VStack gap={20}>
      <PickerHeader
        title="반복"
        onCancel={() => onClose({ type: 'cancel' })}
        onConfirm={handleConfirm}
        isConfirmDisabled={isConfirmDisabled}
      />

      <DayOfWeekSelector repeatSetting={repeatSetting} />

      <RepeatCalendar
        picker={picker}
        today={today}
        startDate={startDate}
        endDate={repeatSetting.endDate}
        onDatePress={handleCalendarPress}
      />

      <VStack className="border-t border-gray-2 px-4 pt-3">
        <HStack align="center" justify="between" gap={8}>
          <HStack gap={4} align="center" className="shrink">
            <Text size="b3" tone="neutral" shade={7}>
              반복 기간
            </Text>
            <Text size="b3" tone="neutral" shade={6}>
              •
            </Text>
            {repeatSetting.endDate && !isSameDay(startDate, repeatSetting.endDate) ? (
              <Text size="b3" tone="brand">
                {formatMonthDay(startDate)} - {formatMonthDay(repeatSetting.endDate)}
              </Text>
            ) : (
              <Text size="b3" tone="neutral" shade={5}>
                기간을 선택해주세요
              </Text>
            )}
          </HStack>
          {hasExistingRepeat && (
            <Button
              size="small"
              variant="weak"
              color="danger"
              display="inline"
              onPress={() => onClose({ type: 'reset' })}
            >
              삭제
            </Button>
          )}
        </HStack>
      </VStack>
    </VStack>
  );
};

interface RepeatCalendarProps {
  picker: ReturnType<typeof useDatePicker>;
  today: Date;
  startDate: Date;
  endDate: Date | null;
  onDatePress: (date: Date) => void;
}

const RepeatCalendar = ({
  picker,
  today,
  startDate,
  endDate,
  onDatePress,
}: RepeatCalendarProps) => {
  const { displayMonth, weeks, goToPrevMonth, goToNextMonth } = picker;

  return (
    <VStack gap={16}>
      <HStack className="items-center justify-between" px={16}>
        <PressableFeedback onPress={goToPrevMonth} hitSlop={12}>
          <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />
        </PressableFeedback>
        <Text size="b2" weight="semibold" tone="neutral" shade={9}>
          {getMonthHeaderText(displayMonth)}
        </Text>
        <PressableFeedback onPress={goToNextMonth} hitSlop={12}>
          <ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />
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
                  today={today}
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
  today: Date;
  startDate: Date;
  endDate: Date | null;
  onPress: (date: Date) => void;
}

const RepeatDateCell = ({ date, today, startDate, endDate, onPress }: RepeatDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isDisabled = isBeforeDay(date, today);
  const isStart = isSameDay(date, startDate);
  const isEnd = endDate !== null && isSameDay(date, endDate);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected });
  const highlightToday = !isDisabled && isTodayHighlighted({ date, isSelected });

  const hasDistinctRange = endDate !== null && !isSameDay(startDate, endDate);
  const isInRange = hasDistinctRange && isAfterDay(date, startDate) && isBeforeDay(date, endDate);
  const isRangeStart = hasDistinctRange && isStart;
  const isRangeEnd = hasDistinctRange && isEnd;

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      isDisabled={isDisabled}
      className={cn(
        'relative h-[48px] flex-1 items-center justify-center',
        isDisabled && 'opacity-30',
      )}
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
          tone={isDisabled ? 'neutral' : DAY_TYPE_TONE[dayStyle]}
          shade={isSelected ? undefined : 7}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
};

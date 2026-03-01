import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowLeftIcon, ArrowRightIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import {
  formatMonthDay,
  getMonthHeaderText,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  isSameMonth,
  WEEKDAY_LABELS,
} from '@src/shared/utils/date';
import dayjs from 'dayjs';
import { PressableFeedback, Switch } from 'heroui-native';
import { useMemo } from 'react';
import { type DatePicker, useDatePicker } from '../hooks/useDatePicker';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { CalendarWeekdayHeader } from './Calendar/CalendarWeekdayHeader';
import { PickerHeader } from './PickerHeader';

interface TodoDatePickerContentProps {
  startDate: Date;
  endDate: Date | null;
  onConfirm: (startDate: Date, endDate: Date | null) => void;
  onCancel: () => void;
}

export const TodoDatePickerContent = ({
  startDate,
  endDate,
  onConfirm,
  onCancel,
}: TodoDatePickerContentProps) => {
  const picker = useDatePicker({ startDate, endDate });

  return (
    <VStack gap={20}>
      <PickerHeader
        title="날짜"
        onCancel={onCancel}
        onConfirm={() => onConfirm(picker.localStartDate, picker.localEndDate)}
      />

      <QuickDateOptions picker={picker} onSelect={(date) => onConfirm(date, null)} />

      <DatePickerCalendar picker={picker} />

      <RangeDateToggle picker={picker} />
    </VStack>
  );
};

interface QuickDateOption {
  label: string;
  day: string;
  date: Date;
}

const getQuickDateOptions = (): QuickDateOption[] => {
  const today = dayjs();
  const tomorrow = today.add(1, 'day');
  return [
    { label: '오늘', day: WEEKDAY_LABELS[today.day()], date: today.toDate() },
    { label: '내일', day: WEEKDAY_LABELS[tomorrow.day()], date: tomorrow.toDate() },
  ];
};

interface QuickDateOptionsProps {
  picker: DatePicker;
  onSelect: (date: Date) => void;
}

const QuickDateOptions = ({ picker, onSelect }: QuickDateOptionsProps) => {
  const { isRange, localStartDate } = picker;
  const options = useMemo(() => getQuickDateOptions(), []);

  return (
    <VStack gap={4}>
      {options.map((option) => {
        const isSelected = !isRange && isSameDay(localStartDate, option.date);
        const tone = isSelected ? 'brand' : 'neutral';
        return (
          <PressableFeedback
            key={option.label}
            onPress={() => onSelect(option.date)}
            className={cn('rounded-lg', isSelected && 'bg-main/5')}
          >
            <ListRow
              contents={
                <ListRow.Texts
                  type="1RowTypeA"
                  top={option.label}
                  topProps={{
                    size: 'b2',
                    weight: 'medium',
                    tone,
                    shade: isSelected ? undefined : 8,
                  }}
                />
              }
              right={
                <Text size="b2" tone={tone} shade={isSelected ? undefined : 6}>
                  {option.day}
                </Text>
              }
              horizontalPadding="medium"
              verticalPadding="medium"
            />
          </PressableFeedback>
        );
      })}
    </VStack>
  );
};

interface DatePickerCalendarProps {
  picker: DatePicker;
}

const DatePickerCalendar = ({ picker }: DatePickerCalendarProps) => {
  const {
    displayMonth,
    weeks,
    localStartDate,
    localEndDate,
    isRange,
    selectDate,
    goToPrevMonth,
    goToNextMonth,
  } = picker;

  return (
    <VStack gap={16}>
      <HStack className="items-center justify-between" px={16}>
        <PressableFeedback onPress={goToPrevMonth}>
          <ArrowLeftIcon width={20} height={20} colorClassName="text-neutral-7" />
        </PressableFeedback>
        <Text size="b2" weight="semibold" tone="neutral" shade={9}>
          {getMonthHeaderText(displayMonth)}
        </Text>
        <PressableFeedback onPress={goToNextMonth}>
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
                <DatePickerDateCell
                  key={date.toISOString()}
                  date={date}
                  localStartDate={localStartDate}
                  localEndDate={localEndDate}
                  isRange={isRange}
                  onPress={selectDate}
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

interface DatePickerDateCellProps {
  date: Date;
  localStartDate: Date;
  localEndDate: Date | null;
  isRange: boolean;
  onPress: (date: Date) => void;
}

const DatePickerDateCell = ({
  date,
  localStartDate,
  localEndDate,
  isRange,
  onPress,
}: DatePickerDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isStart = isSameDay(date, localStartDate);
  const isEnd = localEndDate !== null && isSameDay(date, localEndDate);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected });
  const highlightToday = isTodayHighlighted({ date, isSelected });

  const hasDistinctRange =
    isRange && localEndDate !== null && !isSameDay(localStartDate, localEndDate);

  const isInRange =
    hasDistinctRange && isAfterDay(date, localStartDate) && isBeforeDay(date, localEndDate);

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

interface RangeDateToggleProps {
  picker: DatePicker;
}

const RangeDateToggle = ({ picker }: RangeDateToggleProps) => {
  const { isRange, localStartDate, localEndDate, toggleRange } = picker;

  return (
    <ListRow
      contents={
        <ListRow.Texts
          type="1RowTypeA"
          top={
            <HStack gap={8} align="center">
              <Text size="b2" weight="medium" shade={8}>
                기간 선택
              </Text>
              {isRange && localEndDate && !isSameDay(localStartDate, localEndDate) && (
                <Text size="b3" tone="brand">
                  {formatMonthDay(localStartDate)} - {formatMonthDay(localEndDate)}
                </Text>
              )}
            </HStack>
          }
        />
      }
      right={<Switch isSelected={isRange} onSelectedChange={toggleRange} />}
      horizontalPadding="medium"
      verticalPadding="medium"
      className="border-t border-gray-2"
    />
  );
};

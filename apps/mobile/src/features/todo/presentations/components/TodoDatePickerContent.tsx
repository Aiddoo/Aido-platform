import type { DayOfWeek } from '@aido/validators';
import { ArrowLeftIcon, ArrowRightIcon, Box, HStack, ListRow, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  getMonthHeaderText,
  getWeekdayLabels,
  isSameDay,
  isSameMonth,
} from '@src/shared/utils/date';
import dayjs from 'dayjs';
import { PressableFeedback } from 'heroui-native';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { type DatePicker, useDatePicker } from '../hooks/useDatePicker';
import type { RepeatSetting } from '../hooks/useRepeatSetting';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { CalendarWeekdayHeader } from './Calendar/CalendarWeekdayHeader';
import { PickerHeader } from './PickerHeader';

interface TodoDatePickerContentProps {
  startDate: Date;
  onConfirm: (startDate: Date) => void;
  onCancel: () => void;
}

export const TodoDatePickerContent = ({
  startDate,
  onConfirm,
  onCancel,
}: TodoDatePickerContentProps) => {
  const picker = useDatePicker({ startDate });

  const handleConfirm = () => {
    onConfirm(picker.date);
  };

  const handleQuickSelect = (date: Date) => {
    onConfirm(date);
  };

  return (
    <VStack gap={20}>
      <PickerHeader title="날짜" onCancel={onCancel} onConfirm={handleConfirm} />

      <QuickDateOptions picker={picker} onSelect={handleQuickSelect} />

      <DatePickerCalendar picker={picker} onDatePress={picker.selectDate} />
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
    { label: '오늘', day: getWeekdayLabels()[today.day()] as string, date: today.toDate() },
    { label: '내일', day: getWeekdayLabels()[tomorrow.day()] as string, date: tomorrow.toDate() },
  ];
};

interface QuickDateOptionsProps {
  picker: DatePicker;
  onSelect: (date: Date) => void;
}

const QuickDateOptions = ({ picker, onSelect }: QuickDateOptionsProps) => {
  const { date: pickerDate } = picker;
  const options = useMemo(() => getQuickDateOptions(), []);

  return (
    <VStack gap={4}>
      {options.map((option) => {
        const isSelected = isSameDay(pickerDate, option.date);
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
  onDatePress: (date: Date) => void;
}

const DatePickerCalendar = ({ picker, onDatePress }: DatePickerCalendarProps) => {
  const { displayMonth, weeks, date: startDate, goToPrevMonth, goToNextMonth } = picker;

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
                <DatePickerDateCell
                  key={date.toISOString()}
                  date={date}
                  startDate={startDate}
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

interface DatePickerDateCellProps {
  date: Date;
  startDate: Date;
  onPress: (date: Date) => void;
}

const DatePickerDateCell = ({ date, startDate, onPress }: DatePickerDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isSelected = isSameDay(date, startDate);
  const dayStyle = getDatePickerDayStyle({ date, isSelected });
  const highlightToday = isTodayHighlighted({ date, isSelected });

  return (
    <PressableFeedback
      onPress={() => onPress(date)}
      className="relative h-[48px] flex-1 items-center justify-center"
    >
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

const DAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'MON', label: '월' },
  { key: 'TUE', label: '화' },
  { key: 'WED', label: '수' },
  { key: 'THU', label: '목' },
  { key: 'FRI', label: '금' },
  { key: 'SAT', label: '토' },
  { key: 'SUN', label: '일' },
];

interface DayOfWeekSelectorProps {
  repeatSetting: RepeatSetting;
}

const formatSelectedDays = (days: DayOfWeek[]): string => {
  const dayOrder: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const sorted = dayOrder.filter((d) => days.includes(d));
  return sorted.map((d) => DAY_LABELS.find((l) => l.key === d)?.label ?? '').join(', ');
};

const getRepeatSummary = ({
  selectedDays,
  isAllSelected,
  isWeekdaysSelected,
  isWeekendsSelected,
}: {
  selectedDays: DayOfWeek[];
  isAllSelected: boolean;
  isWeekdaysSelected: boolean;
  isWeekendsSelected: boolean;
}): string => {
  if (isAllSelected) return '매일 반복';
  if (isWeekdaysSelected) return '주중 반복';
  if (isWeekendsSelected) return '주말 반복';
  return `매주 ${formatSelectedDays(selectedDays)} 반복`;
};

interface PresetChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

const PresetChip = ({ label, isSelected, onPress }: PresetChipProps) => (
  <PressableFeedback
    onPress={onPress}
    className={cn(
      'h-8 items-center justify-center rounded-4xl px-3',
      isSelected ? 'bg-main' : 'bg-gray-2',
    )}
  >
    <Text
      size="b4"
      weight="medium"
      className={isSelected ? 'text-white' : undefined}
      shade={isSelected ? undefined : 7}
    >
      {label}
    </Text>
  </PressableFeedback>
);

export const DayOfWeekSelector = ({ repeatSetting }: DayOfWeekSelectorProps) => {
  const {
    selectedDays,
    toggleDay,
    toggleAllDays,
    toggleWeekdays,
    toggleWeekends,
    isAllDaysSelected,
    isWeekdaysSelected,
    isWeekendsSelected,
  } = repeatSetting;

  return (
    <VStack gap={12}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5 px-4"
      >
        <PresetChip label="매일" isSelected={isAllDaysSelected} onPress={toggleAllDays} />
        <PresetChip label="주중" isSelected={isWeekdaysSelected} onPress={toggleWeekdays} />
        <PresetChip label="주말" isSelected={isWeekendsSelected} onPress={toggleWeekends} />
        {DAY_LABELS.map(({ key, label }) => {
          const isSelected = selectedDays.includes(key);
          return (
            <PressableFeedback
              key={key}
              onPress={() => toggleDay(key)}
              className={cn(
                'size-8 items-center justify-center rounded-4xl',
                isSelected ? 'bg-main' : 'bg-gray-2',
              )}
            >
              <Text
                size="b4"
                weight="medium"
                className={isSelected ? 'text-white' : undefined}
                shade={isSelected ? undefined : 7}
              >
                {label}
              </Text>
            </PressableFeedback>
          );
        })}
      </ScrollView>
      {selectedDays.length > 0 ? (
        <Text size="b3" tone="brand" align="right" className="px-4">
          *{' '}
          {getRepeatSummary({
            selectedDays,
            isAllSelected: isAllDaysSelected,
            isWeekdaysSelected,
            isWeekendsSelected,
          })}
        </Text>
      ) : (
        <Text size="b3" tone="neutral" shade={5} align="right" className="px-4">
          * 요일을 선택해주세요
        </Text>
      )}
    </VStack>
  );
};

import type { DayOfWeek } from '@aido/validators';
import { Box } from '@src/shared/ui/Box';
import { HStack } from '@src/shared/ui/HStack';
import { ArrowLeftIcon, ArrowRightIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
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
import { useRepeatSetting } from '../hooks/useRepeatSetting';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { getDayOfWeekFromDate } from '../utils/day-of-week';
import { CalendarWeekdayHeader } from './Calendar/CalendarWeekdayHeader';
import { PickerHeader } from './PickerHeader';

interface RepeatState {
  isRecurring: boolean;
  daysOfWeek: DayOfWeek[];
  repeatEndDate: Date | null;
}

interface TodoDatePickerContentProps {
  startDate: Date;
  repeat?: RepeatState;
  showRepeat?: boolean;
  onConfirm: (startDate: Date, repeat: RepeatState | null) => void;
  onCancel: () => void;
}

const getInitialSelectedDays = (startDate: Date, repeat?: RepeatState): DayOfWeek[] => {
  if (repeat?.daysOfWeek && repeat.daysOfWeek.length > 0) return repeat.daysOfWeek;

  const dayOfWeek = getDayOfWeekFromDate(startDate);
  return dayOfWeek ? [dayOfWeek] : [];
};

export const TodoDatePickerContent = ({
  startDate,
  repeat,
  showRepeat = false,
  onConfirm,
  onCancel,
}: TodoDatePickerContentProps) => {
  const picker = useDatePicker({ startDate });
  const repeatSetting = useRepeatSetting({
    isEnabled: repeat?.isRecurring ?? false,
    selectedDays: getInitialSelectedDays(startDate, repeat),
    endDate: repeat?.repeatEndDate ?? null,
  });

  const handleConfirm = () => {
    if (repeatSetting.isEnabled) {
      onConfirm(picker.date, {
        isRecurring: true,
        daysOfWeek: repeatSetting.selectedDays,
        repeatEndDate: repeatSetting.endDate,
      });
    } else {
      onConfirm(
        picker.date,
        showRepeat ? { isRecurring: false, daysOfWeek: [], repeatEndDate: null } : null,
      );
    }
  };

  const handleQuickSelect = (date: Date) => {
    onConfirm(
      date,
      showRepeat ? { isRecurring: false, daysOfWeek: [], repeatEndDate: null } : null,
    );
  };

  const handleCalendarPress = (date: Date) => {
    const isSettingEndDate =
      repeatSetting.isEnabled && repeatSetting.endDate === null && !isBeforeDay(date, picker.date);

    if (isSettingEndDate) {
      repeatSetting.setEndDate(date);
      return;
    }

    picker.selectDate(date);
    if (repeatSetting.endDate !== null) repeatSetting.clearEndDate();
  };

  return (
    <VStack gap={20}>
      <PickerHeader title="날짜" onCancel={onCancel} onConfirm={handleConfirm} />

      {!repeatSetting.isEnabled && (
        <QuickDateOptions picker={picker} onSelect={handleQuickSelect} />
      )}

      {repeatSetting.isEnabled && (
        <DayOfWeekSelector
          selectedDays={repeatSetting.selectedDays}
          onToggleDay={repeatSetting.toggleDay}
          onToggleAll={repeatSetting.toggleAllDays}
          isAllSelected={repeatSetting.isAllDaysSelected}
        />
      )}

      <DatePickerCalendar
        picker={picker}
        endDate={repeatSetting.endDate}
        isRange={repeatSetting.isEnabled}
        onDatePress={handleCalendarPress}
      />

      {showRepeat && (
        <RepeatToggle
          isRange={repeatSetting.isEnabled}
          startDate={picker.date}
          endDate={repeatSetting.endDate}
          onToggle={(enabled) => {
            repeatSetting.toggle(enabled, picker.date);
          }}
        />
      )}
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
  endDate: Date | null;
  isRange: boolean;
  onDatePress: (date: Date) => void;
}

const DatePickerCalendar = ({ picker, endDate, isRange, onDatePress }: DatePickerCalendarProps) => {
  const { displayMonth, weeks, date: startDate, goToPrevMonth, goToNextMonth } = picker;

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
                <DatePickerDateCell
                  key={date.toISOString()}
                  date={date}
                  startDate={startDate}
                  endDate={endDate}
                  isRange={isRange}
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
  endDate: Date | null;
  isRange: boolean;
  onPress: (date: Date) => void;
}

const DatePickerDateCell = ({
  date,
  startDate,
  endDate,
  isRange,
  onPress,
}: DatePickerDateCellProps) => {
  const dayOfMonth = date.getDate();
  const isStart = isSameDay(date, startDate);
  const isEnd = endDate !== null && isSameDay(date, endDate);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected });
  const highlightToday = isTodayHighlighted({ date, isSelected });

  const hasDistinctRange = isRange && endDate !== null && !isSameDay(startDate, endDate);

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

interface RepeatToggleProps {
  isRange: boolean;
  startDate: Date;
  endDate: Date | null;
  onToggle: (enabled: boolean) => void;
}

const RepeatToggle = ({ isRange, startDate, endDate, onToggle }: RepeatToggleProps) => {
  return (
    <ListRow
      contents={
        <ListRow.Texts
          type="1RowTypeA"
          top={
            <HStack gap={8} align="center">
              <Text size="b2" weight="medium" shade={8}>
                반복 설정
              </Text>
              {isRange && endDate && !isSameDay(startDate, endDate) && (
                <Text size="b3" tone="brand">
                  {formatMonthDay(startDate)} - {formatMonthDay(endDate)}
                </Text>
              )}
            </HStack>
          }
        />
      }
      right={<Switch isSelected={isRange} onSelectedChange={onToggle} />}
      horizontalPadding="medium"
      verticalPadding="medium"
      className="border-t border-gray-2"
    />
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
  selectedDays: DayOfWeek[];
  onToggleDay: (day: DayOfWeek) => void;
  onToggleAll: () => void;
  isAllSelected: boolean;
}

const DayOfWeekSelector = ({
  selectedDays,
  onToggleDay,
  onToggleAll,
  isAllSelected,
}: DayOfWeekSelectorProps) => {
  return (
    <VStack gap={12} px={16}>
      <Text size="b3" weight="medium" shade={7}>
        반복 요일
      </Text>
      <HStack gap={6} align="center" justify="between">
        {DAY_LABELS.map(({ key, label }) => {
          const isSelected = selectedDays.includes(key);
          return (
            <PressableFeedback
              key={key}
              onPress={() => onToggleDay(key)}
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
        <PressableFeedback
          onPress={onToggleAll}
          className={cn(
            'h-8 items-center justify-center rounded-4xl px-3',
            isAllSelected ? 'bg-main' : 'bg-gray-2',
          )}
        >
          <Text
            size="b4"
            weight="medium"
            className={isAllSelected ? 'text-white' : undefined}
            shade={isAllSelected ? undefined : 7}
          >
            매일
          </Text>
        </PressableFeedback>
      </HStack>
    </VStack>
  );
};

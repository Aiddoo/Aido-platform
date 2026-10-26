import type { DayOfWeek } from '@aido/api';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, ArrowRightIcon, Box, Button, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  formatDate,
  formatDaysOfWeek,
  getDayOfWeekLabel,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  isSameMonth,
} from '@src/shared/utils/date';
import { formatDateKeyLabel } from '@src/shared/utils/date-format';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { ALL_DAYS_OF_WEEK } from '../constants/day-of-week';
import { useDatePicker } from '../hooks/use-date-picker';
import { type RepeatSetting, useRepeatSetting } from '../hooks/use-repeat-setting';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { getDayOfWeekFromDate, hasSelectedDayInRange } from '../utils/day-of-week';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';

interface DayOfWeekSelectorProps {
  repeatSetting: RepeatSetting;
}

type RepeatSummaryKey =
  | 'picker.repeatDaily'
  | 'picker.repeatWeekdays'
  | 'picker.repeatWeekends'
  | 'picker.repeatWeekly';

const getRepeatSummaryKey = ({
  isAllSelected,
  isWeekdaysSelected,
  isWeekendsSelected,
}: {
  isAllSelected: boolean;
  isWeekdaysSelected: boolean;
  isWeekendsSelected: boolean;
}): RepeatSummaryKey => {
  if (isAllSelected) {
    return 'picker.repeatDaily';
  }
  if (isWeekdaysSelected) {
    return 'picker.repeatWeekdays';
  }
  if (isWeekendsSelected) {
    return 'picker.repeatWeekends';
  }
  return 'picker.repeatWeekly';
};

interface PresetChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function PresetChip({ label, isSelected, onPress }: PresetChipProps) {
  return (
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
}

interface DayOfWeekChipProps {
  day: DayOfWeek;
  isSelected: boolean;
  onPress: () => void;
}

function DayOfWeekChip({ day, isSelected, onPress }: DayOfWeekChipProps) {
  return (
    <PressableFeedback
      onPress={onPress}
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
        {getDayOfWeekLabel(day)}
      </Text>
    </PressableFeedback>
  );
}

function DayOfWeekSelector({ repeatSetting }: DayOfWeekSelectorProps) {
  const { t } = useTranslation('todo');
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
        <PresetChip
          label={t('picker.presetDaily')}
          isSelected={isAllDaysSelected}
          onPress={toggleAllDays}
        />
        <PresetChip
          label={t('picker.presetWeekdays')}
          isSelected={isWeekdaysSelected}
          onPress={toggleWeekdays}
        />
        <PresetChip
          label={t('picker.presetWeekends')}
          isSelected={isWeekendsSelected}
          onPress={toggleWeekends}
        />
        {ALL_DAYS_OF_WEEK.map((day) => (
          <DayOfWeekChip
            key={day}
            day={day}
            isSelected={selectedDays.includes(day)}
            onPress={() => toggleDay(day)}
          />
        ))}
      </ScrollView>
      {selectedDays.length > 0 ? (
        <Text size="b3" tone="brand" align="right" className="px-4">
          *{' '}
          {t(
            getRepeatSummaryKey({
              isAllSelected: isAllDaysSelected,
              isWeekdaysSelected,
              isWeekendsSelected,
            }),
            { days: formatDaysOfWeek(selectedDays) },
          )}
        </Text>
      ) : (
        <Text size="b3" tone="neutral" shade={5} align="right" className="px-4">
          * {t('picker.selectDays')}
        </Text>
      )}
    </VStack>
  );
}

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
  if (daysOfWeek.length > 0) {
    return daysOfWeek;
  }
  const dayOfWeek = getDayOfWeekFromDate(startDate);
  return dayOfWeek ? [dayOfWeek] : [];
};

export const TodoRepeatPickerContent = ({
  startDate: initialStartDate,
  repeat,
  onClose,
}: TodoRepeatPickerContentProps) => {
  const { t } = useTranslation(['todo', 'common']);
  const [startDate, setStartDate] = useState(initialStartDate);
  const picker = useDatePicker({ startDate });
  const repeatSetting = useRepeatSetting({
    isEnabled: true,
    selectedDays: getInitialSelectedDays(initialStartDate, repeat.daysOfWeek),
    endDate: repeat.repeatEndDate,
  });

  const hasExistingRepeat = repeat.daysOfWeek.length > 0;
  const hasCompleteRange = repeatSetting.endDate != null;

  const isConfirmDisabled =
    repeatSetting.selectedDays.length === 0 ||
    repeatSetting.endDate == null ||
    !hasSelectedDayInRange(startDate, repeatSetting.endDate, repeatSetting.selectedDays);

  const handleConfirm = () => {
    if (isConfirmDisabled) {
      return;
    }
    onClose({
      type: 'confirm',
      value: {
        daysOfWeek: repeatSetting.selectedDays,
        repeatEndDate: repeatSetting.endDate,
        startDate,
      },
    });
  };

  const today = useToday();
  const dateFormatContext = useDateFormatContext();

  const handleCalendarPress = (date: Date) => {
    if (isBeforeDay(date, today)) {
      return;
    }

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
        title={t('picker.repeatTitle')}
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
              {t('picker.repeatPeriod')}
            </Text>
            <Text size="b3" tone="neutral" shade={6}>
              •
            </Text>
            {repeatSetting.endDate && !isSameDay(startDate, repeatSetting.endDate) ? (
              <Text size="b3" tone="brand">
                {formatDateKeyLabel(formatDate(startDate), 'monthDay', dateFormatContext)} -{' '}
                {formatDateKeyLabel(
                  formatDate(repeatSetting.endDate),
                  'monthDay',
                  dateFormatContext,
                )}
              </Text>
            ) : (
              <Text size="b3" tone="neutral" shade={5}>
                {t('picker.selectPeriod')}
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
              {t('common:actions.delete')}
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
  const dateFormatContext = useDateFormatContext();

  return (
    <VStack gap={16}>
      <HStack className="items-center justify-between" px={16}>
        <PressableFeedback onPress={goToPrevMonth} hitSlop={12}>
          <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-6" />
        </PressableFeedback>
        <Text size="b2" weight="semibold" tone="neutral" shade={9}>
          {formatDateKeyLabel(formatDate(displayMonth), 'yearMonth', dateFormatContext)}
        </Text>
        <PressableFeedback onPress={goToNextMonth} hitSlop={12}>
          <ArrowRightIcon width={20} height={20} colorClassName="text-gray-6" />
        </PressableFeedback>
      </HStack>

      <CalendarWeekdayHeader />

      <VStack>
        {weeks.map((week, weekIndex) => (
          // 주 순서는 고정되어 index가 안정적인 key다.
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
  const isEnd = endDate != null && isSameDay(date, endDate);
  const isSelected = isStart || isEnd;
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today });
  const shouldHighlightToday = !isDisabled && isTodayHighlighted({ date, isSelected, today });

  const hasDistinctRange = endDate != null && !isSameDay(startDate, endDate);
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
          shouldHighlightToday && 'bg-main/10 dark:bg-main/20',
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

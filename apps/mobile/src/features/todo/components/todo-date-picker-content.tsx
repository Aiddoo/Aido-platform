import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, ArrowRightIcon, Box, HStack, ListRow, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  formatDate,
  getWeekdayLabels,
  getNextDay,
  isSameDay,
  isSameMonth,
  startOfDay,
} from '@src/shared/utils/date';
import { formatDateKeyLabel } from '@src/shared/utils/date-format';
import { PressableFeedback } from 'heroui-native';

import { type DatePicker, useDatePicker } from '../hooks/use-date-picker';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';

interface TodoDatePickerContentProps {
  value: Date;
  onChange: (date: Date) => void;
  onCancel: () => void;
}

export function TodoDatePickerContent({ value, onChange, onCancel }: TodoDatePickerContentProps) {
  const picker = useDatePicker({ startDate: value });
  const { t } = useTranslation('todo');

  const handleConfirm = () => {
    onChange(picker.date);
  };

  return (
    <VStack gap={20}>
      <PickerHeader title={t('picker.dateTitle')} onCancel={onCancel} onConfirm={handleConfirm} />

      <QuickDateOptions picker={picker} onSelect={onChange} />

      <DatePickerCalendar picker={picker} onDatePress={picker.selectDate} />
    </VStack>
  );
}

interface QuickDateOptionsProps {
  picker: DatePicker;
  onSelect: (date: Date) => void;
}

function QuickDateOptions({ picker, onSelect }: QuickDateOptionsProps) {
  const { t } = useTranslation('todo');
  const today = useToday();
  const todayStart = startOfDay(today);
  const tomorrowStart = getNextDay(todayStart);

  return (
    <VStack gap={4}>
      <QuickDateRow
        label={t('picker.today')}
        date={todayStart}
        isSelected={isSameDay(picker.date, todayStart)}
        onSelect={onSelect}
      />
      <QuickDateRow
        label={t('picker.tomorrow')}
        date={tomorrowStart}
        isSelected={isSameDay(picker.date, tomorrowStart)}
        onSelect={onSelect}
      />
    </VStack>
  );
}

interface QuickDateRowProps {
  label: string;
  date: Date;
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

function QuickDateRow({ label, date, isSelected, onSelect }: QuickDateRowProps) {
  const weekdayLabels = getWeekdayLabels();
  const tone = isSelected ? 'brand' : 'neutral';

  return (
    <PressableFeedback
      onPress={() => onSelect(date)}
      className={cn('rounded-lg', isSelected && 'bg-main/5')}
    >
      <ListRow
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
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
            {weekdayLabels[date.getDay()]}
          </Text>
        }
        horizontalPadding="medium"
        verticalPadding="medium"
      />
    </PressableFeedback>
  );
}

interface DatePickerCalendarProps {
  picker: DatePicker;
  onDatePress: (date: Date) => void;
}

const DatePickerCalendar = ({ picker, onDatePress }: DatePickerCalendarProps) => {
  const { displayMonth, weeks, date: startDate, goToPrevMonth, goToNextMonth } = picker;
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
  const today = useToday();
  const isSelected = isSameDay(date, startDate);
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today });
  const highlightToday = isTodayHighlighted({ date, isSelected, today });

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

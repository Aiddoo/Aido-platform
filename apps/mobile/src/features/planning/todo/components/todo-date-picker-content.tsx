import { getDayOfWeek } from '@src/shared/date/date-key';
import { getWeekdayLabels } from '@src/shared/date/date-labels';
import { toDateKey } from '@src/shared/date/instant';
import { addLocalDays, startOfLocalDay } from '@src/shared/date/local-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, ListRow, SheetHeaderLayout, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';

import { type DatePicker, useDatePicker } from '../hooks/use-date-picker';
import { DAY_TYPE_TONE, getDatePickerDayStyle, isTodayHighlighted } from '../utils/calendar-day';
import { isSameDay, isSameMonth } from '../utils/calendar-day-comparison';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';
import { PickerMonthHeader } from './picker-month-header';

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
    <SheetHeaderLayout
      gap={20}
      header={
        <PickerHeader title={t('picker.dateTitle')} onCancel={onCancel} onConfirm={handleConfirm} />
      }
    >
      <VStack gap={20}>
        <QuickDateOptions picker={picker} onSelect={onChange} />

        <DatePickerCalendar picker={picker} onDatePress={picker.selectDate} />
      </VStack>
    </SheetHeaderLayout>
  );
}

interface QuickDateOptionsProps {
  picker: DatePicker;
  onSelect: (date: Date) => void;
}

function QuickDateOptions({ picker, onSelect }: QuickDateOptionsProps) {
  const { t } = useTranslation('todo');
  const today = useToday();
  const { timeZone } = useDateFormatContext();
  const todayStart = startOfLocalDay(today, timeZone);
  const tomorrowStart = addLocalDays(todayStart, 1, timeZone);

  return (
    <VStack gap={4}>
      <QuickDateRow
        label={t('picker.today')}
        date={todayStart}
        isSelected={isSameDay(picker.date, todayStart, timeZone)}
        onSelect={onSelect}
      />
      <QuickDateRow
        label={t('picker.tomorrow')}
        date={tomorrowStart}
        isSelected={isSameDay(picker.date, tomorrowStart, timeZone)}
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
  const { i18n } = useTranslation();
  const { timeZone } = useDateFormatContext();
  const weekdayLabels = getWeekdayLabels(i18n.language);
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
            {weekdayLabels[getDayOfWeek(toDateKey(date, timeZone))]}
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

function DatePickerCalendar({ picker, onDatePress }: DatePickerCalendarProps) {
  const { displayMonth, weeks, date: startDate, goToPrevMonth, goToNextMonth } = picker;
  const dateFormatContext = useDateFormatContext();

  return (
    <VStack gap={16}>
      <PickerMonthHeader
        displayMonth={displayMonth}
        onPreviousPress={goToPrevMonth}
        onNextPress={goToNextMonth}
      />

      <CalendarWeekdayHeader />

      {/* 달마다 4~6주라 6주 높이(48 × 6)를 미리 잡아 달을 넘겨도 시트 높이가 변하지 않게 한다 */}
      <VStack className="h-[288px]">
        {weeks.map((week, weekIndex) => (
          // 주 순서는 고정되어 index가 안정적인 key다.
          <HStack key={weekIndex} px={8}>
            {week.map((date) =>
              isSameMonth(date, displayMonth, dateFormatContext.timeZone) ? (
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
}

interface DatePickerDateCellProps {
  date: Date;
  startDate: Date;
  onPress: (date: Date) => void;
}

function DatePickerDateCell({ date, startDate, onPress }: DatePickerDateCellProps) {
  const dayOfMonth = date.getDate();
  const today = useToday();
  const { timeZone } = useDateFormatContext();
  const isSelected = isSameDay(date, startDate, timeZone);
  const dayStyle = getDatePickerDayStyle({ date, isSelected, today, timeZone });
  const highlightToday = isTodayHighlighted({ date, isSelected, today, timeZone });

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
}

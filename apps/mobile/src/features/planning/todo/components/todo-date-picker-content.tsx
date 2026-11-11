import { getDayOfWeek } from '@src/shared/date/date-key';
import { formatDateLabel } from '@src/shared/date/format/date-format';
import { getWeekdayLabels } from '@src/shared/date/format/date-labels';
import { addLocalDays, startOfLocalDay, toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, ListRow, SheetHeaderLayout, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';

import { PICKER_DATE_CELL_HEIGHT, PICKER_MONTH_HEIGHT } from '../constants/todo.constants';
import { type DatePicker, useDatePicker } from '../hooks/use-date-picker';
import { DAY_TYPE_TONE, getDatePickerDayType, isTodayHighlighted } from '../utils/calendar-day';
import { isSameDay, isSameMonth } from '../utils/calendar-day-comparison';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerHeader } from './picker-header';
import { PickerMonthHeader } from './picker-month-header';

interface TodoDatePickerContentProps {
  value: Date;
  onChange: (date: Date) => void;
  onCancel: () => void;
  /** 고른 날짜를 저장하는 동안 확인을 막는다 */
  isConfirmDisabled?: boolean;
}

// oxlint-disable-next-line aido/component-name -- 1.15.2 전환 #1400
export function TodoDatePickerContent({
  value,
  onChange,
  onCancel,
  isConfirmDisabled = false,
}: TodoDatePickerContentProps) {
  const picker = useDatePicker({ initialDate: value });
  const { t } = useTranslation('todo');

  const handleConfirm = () => {
    onChange(picker.selectedDate);
  };

  return (
    <SheetHeaderLayout
      gap={20}
      header={
        <PickerHeader
          title={t('picker.dateTitle')}
          onCancel={onCancel}
          onConfirm={handleConfirm}
          isConfirmDisabled={isConfirmDisabled}
        />
      }
    >
      <VStack gap={20}>
        <QuickDateOptions picker={picker} onChange={onChange} />

        <DatePickerCalendar picker={picker} onValueChange={picker.selectDate} />
      </VStack>
    </SheetHeaderLayout>
  );
}

interface QuickDateOptionsProps {
  picker: DatePicker;
  onChange: (date: Date) => void;
}

function QuickDateOptions({ picker, onChange }: QuickDateOptionsProps) {
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
        isSelected={isSameDay(picker.selectedDate, todayStart, timeZone)}
        onChange={onChange}
      />
      <QuickDateRow
        label={t('picker.tomorrow')}
        date={tomorrowStart}
        isSelected={isSameDay(picker.selectedDate, tomorrowStart, timeZone)}
        onChange={onChange}
      />
    </VStack>
  );
}

interface QuickDateRowProps {
  label: string;
  date: Date;
  isSelected: boolean;
  onChange: (date: Date) => void;
}

function QuickDateRow({ label, date, isSelected, onChange }: QuickDateRowProps) {
  const { i18n } = useTranslation();
  const { timeZone } = useDateFormatContext();
  const weekdayLabels = getWeekdayLabels(i18n.language);
  const tone = isSelected ? 'brand' : 'neutral';

  return (
    <PressableFeedback
      onPress={() => onChange(date)}
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
  onValueChange: (date: Date) => void;
}

function DatePickerCalendar({ picker, onValueChange }: DatePickerCalendarProps) {
  const { displayMonth, weeks, selectedDate, goToPrevMonth, goToNextMonth } = picker;
  const dateFormatContext = useDateFormatContext();

  return (
    <VStack gap={16}>
      <PickerMonthHeader
        displayMonth={displayMonth}
        onPreviousMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
      />

      <CalendarWeekdayHeader />

      <VStack style={{ height: PICKER_MONTH_HEIGHT }}>
        {weeks.map((week, weekIndex) => (
          // 주 순서는 고정되어 index가 안정적인 key다.
          <HStack key={weekIndex} px={8}>
            {week.map((date) =>
              isSameMonth(date, displayMonth, dateFormatContext.timeZone) ? (
                <DatePickerDateCell
                  key={date.toISOString()}
                  date={date}
                  selectedDate={selectedDate}
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
        ))}
      </VStack>
    </VStack>
  );
}

interface DatePickerDateCellProps {
  date: Date;
  selectedDate: Date;
  onPress: (date: Date) => void;
}

function DatePickerDateCell({ date, selectedDate, onPress }: DatePickerDateCellProps) {
  const dayOfMonth = date.getDate();
  const today = useToday();
  const dateFormatContext = useDateFormatContext();
  const { timeZone } = dateFormatContext;
  const isSelected = isSameDay(date, selectedDate, timeZone);
  const dayType = getDatePickerDayType({ date, isSelected, today, timeZone });
  const highlightToday = isTodayHighlighted({ date, isSelected, today, timeZone });

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={formatDateLabel(date, 'fullDate', dateFormatContext)}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onPress(date)}
      style={{ height: PICKER_DATE_CELL_HEIGHT }}
      className="relative flex-1 items-center justify-center"
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
          tone={DAY_TYPE_TONE[dayType]}
          shade={isSelected ? undefined : 7}
        >
          {dayOfMonth}
        </Text>
      </Box>
    </PressableFeedback>
  );
}

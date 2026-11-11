import { addDaysToDateKey, getDayOfWeek } from '@src/shared/date/date-key';
import { getWeekdayLabels } from '@src/shared/date/format/date-labels';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { HStack, ListRow, SheetHeaderLayout, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';

import { PICKER_MONTH_HEIGHT } from '../constants/todo.constants';
import { type DatePicker, useDatePicker } from '../hooks/use-date-picker';
import { getPickerDayType } from '../utils/calendar-day';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerDateCell } from './picker-date-cell';
import { PickerHeader } from './picker-header';
import { PickerMonthHeader } from './picker-month-header';

interface TodoDatePickerContentProps {
  /** 고른 날짜(YYYY-MM-DD) */
  value: string;
  onChange: (dateKey: string) => void;
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
  const picker = useDatePicker({ initialDateKey: value });
  const { t } = useTranslation('todo');

  const handleConfirm = () => {
    onChange(picker.selectedDateKey);
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
  onChange: (dateKey: string) => void;
}

function QuickDateOptions({ picker, onChange }: QuickDateOptionsProps) {
  const { t } = useTranslation('todo');
  const todayKey = useTodayKey();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  return (
    <VStack gap={4}>
      <QuickDateRow
        label={t('picker.today')}
        dateKey={todayKey}
        isSelected={picker.selectedDateKey === todayKey}
        onChange={onChange}
      />
      <QuickDateRow
        label={t('picker.tomorrow')}
        dateKey={tomorrowKey}
        isSelected={picker.selectedDateKey === tomorrowKey}
        onChange={onChange}
      />
    </VStack>
  );
}

interface QuickDateRowProps {
  label: string;
  dateKey: string;
  isSelected: boolean;
  onChange: (dateKey: string) => void;
}

function QuickDateRow({ label, dateKey, isSelected, onChange }: QuickDateRowProps) {
  const { i18n } = useTranslation();
  const weekdayLabels = getWeekdayLabels(i18n.language);
  const tone = isSelected ? 'brand' : 'neutral';

  return (
    <PressableFeedback
      onPress={() => onChange(dateKey)}
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
            {weekdayLabels[getDayOfWeek(dateKey)]}
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
  onValueChange: (dateKey: string) => void;
}

function DatePickerCalendar({ picker, onValueChange }: DatePickerCalendarProps) {
  const { displayMonthKey, weeks, selectedDateKey, goToPrevMonth, goToNextMonth } = picker;
  const todayKey = useTodayKey();

  return (
    <VStack gap={16}>
      <PickerMonthHeader
        displayMonthKey={displayMonthKey}
        onPreviousMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
      />

      <CalendarWeekdayHeader />

      <VStack style={{ height: PICKER_MONTH_HEIGHT }}>
        {weeks.map((week, weekIndex) => (
          // 주 순서는 고정되어 index가 안정적인 key다.
          <HStack key={weekIndex} px={8}>
            {week.map(({ dateKey, dayNumber, label, dayOfWeek, isOutsideMonth }) => {
              if (isOutsideMonth) {
                return <PickerDateCell.Placeholder key={dateKey} />;
              }
              const isSelected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;

              return (
                <PickerDateCell
                  key={dateKey}
                  dateKey={dateKey}
                  dayNumber={dayNumber}
                  label={label}
                  dayType={getPickerDayType({ dayOfWeek, isSelected, isToday })}
                  isSelected={isSelected}
                  isTodayHighlighted={!isSelected && isToday}
                  onPress={onValueChange}
                />
              );
            })}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

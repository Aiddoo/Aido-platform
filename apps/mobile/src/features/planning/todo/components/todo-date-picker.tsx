import { addDaysToDateKey, getDayOfWeek, type DateKey } from '@src/shared/date/date-key';
import { getWeekdayLabels } from '@src/shared/date/format/date-labels';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { HStack, ListRow, SheetHeaderLayout, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';

import { PICKER_MONTH_HEIGHT } from '../constants/todo.constants';
import { useDatePicker } from '../hooks/use-date-picker';
import { getPickerDayType } from '../utils/calendar-day.view-model';
import type { CalendarDayCell } from '../utils/calendar-month.view-model';
import { CalendarWeekdayHeader } from './calendar/calendar-weekday-header';
import { PickerDateCell } from './picker-date-cell';
import { PickerHeader } from './picker-header';
import { PickerMonthHeader } from './picker-month-header';

interface TodoDatePickerProps {
  /** 고른 날짜(YYYY-MM-DD) */
  value: DateKey;
  onChange: (dateKey: DateKey) => void;
  onCancel: () => void;
  /** 고른 날짜를 저장하는 동안 확인을 막는다 */
  isConfirmDisabled?: boolean;
}

export function TodoDatePicker({
  value,
  onChange,
  onCancel,
  isConfirmDisabled = false,
}: TodoDatePickerProps) {
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
        <QuickDateOptions selectedDateKey={picker.selectedDateKey} onSelect={onChange} />

        <DatePickerCalendar
          displayMonthKey={picker.displayMonthKey}
          weeks={picker.weeks}
          selectedDateKey={picker.selectedDateKey}
          onPreviousMonth={picker.goToPrevMonth}
          onNextMonth={picker.goToNextMonth}
          onSelect={picker.selectDate}
        />
      </VStack>
    </SheetHeaderLayout>
  );
}

interface QuickDateOptionsProps {
  selectedDateKey: DateKey;
  onSelect: (dateKey: DateKey) => void;
}

function QuickDateOptions({ selectedDateKey, onSelect }: QuickDateOptionsProps) {
  const { t } = useTranslation('common');
  const todayKey = useTodayKey();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  return (
    <VStack gap={4}>
      <QuickDateRow
        label={t('relativeDay.today')}
        dateKey={todayKey}
        isSelected={selectedDateKey === todayKey}
        onPress={onSelect}
      />
      <QuickDateRow
        label={t('relativeDay.tomorrow')}
        dateKey={tomorrowKey}
        isSelected={selectedDateKey === tomorrowKey}
        onPress={onSelect}
      />
    </VStack>
  );
}

interface QuickDateRowProps {
  label: string;
  dateKey: DateKey;
  isSelected: boolean;
  onPress: (dateKey: DateKey) => void;
}

function QuickDateRow({ label, dateKey, isSelected, onPress }: QuickDateRowProps) {
  const { i18n } = useTranslation();
  const weekdayLabels = getWeekdayLabels(i18n.language);
  const tone = isSelected ? 'brand' : 'neutral';

  return (
    <PressableFeedback
      onPress={() => onPress(dateKey)}
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
  /** 보이는 달의 1일 */
  displayMonthKey: DateKey;
  weeks: readonly (readonly CalendarDayCell[])[];
  selectedDateKey: DateKey;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelect: (dateKey: DateKey) => void;
}

function DatePickerCalendar({
  displayMonthKey,
  weeks,
  selectedDateKey,
  onPreviousMonth,
  onNextMonth,
  onSelect,
}: DatePickerCalendarProps) {
  const todayKey = useTodayKey();

  return (
    <VStack gap={16}>
      <PickerMonthHeader
        displayMonthKey={displayMonthKey}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
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
                  onPress={onSelect}
                />
              );
            })}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

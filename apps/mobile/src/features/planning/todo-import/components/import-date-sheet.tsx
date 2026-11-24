import { DatePickerCalendar } from '@src/features/planning/todo/components/todo-date-picker';
import { useDatePicker } from '@src/features/planning/todo/hooks/use-date-picker';
import type { DateKey } from '@src/shared/date/date-key';

interface ImportDateSheetProps {
  value: DateKey;
  onChange: (dateKey: DateKey) => void;
  minimum: DateKey;
  /** null이면 막지 않는다 */
  maximum: DateKey | null;
}

/** 날을 누르면 확인 없이 바로 고른다 */
export function ImportDateSheet({ value, onChange, minimum, maximum }: ImportDateSheetProps) {
  const picker = useDatePicker({ initialDateKey: value });

  return (
    <DatePickerCalendar
      displayMonthKey={picker.displayMonthKey}
      weeks={picker.weeks}
      selectedDateKey={picker.selectedDateKey}
      onPreviousMonth={picker.goToPrevMonth}
      onNextMonth={picker.goToNextMonth}
      onSelect={onChange}
      minimumDateKey={minimum}
      maximumDateKey={maximum ?? undefined}
    />
  );
}

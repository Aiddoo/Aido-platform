import { DatePickerCalendar } from '@src/features/planning/todo/components/todo-date-picker';
import { useDatePicker } from '@src/features/planning/todo/hooks/use-date-picker';
import type { DateKey } from '@src/shared/date/date-key';

interface ImportDateSheetProps {
  value: DateKey;
  onChange: (dateKey: DateKey) => void;
  /** 이 날보다 앞은 고를 수 없다(포함) */
  minimum: DateKey;
  /** 이 날보다 뒤는 고를 수 없다(포함). 없으면 막지 않는다 */
  maximum: DateKey | null;
}

/** 할 일 날짜 피커와 같은 달력. 날을 누르면 바로 고른다 */
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

import { DatePickerCalendar } from '@src/features/planning/todo/components/todo-date-picker';
import { useDatePicker } from '@src/features/planning/todo/hooks/use-date-picker';
import type { DateKey } from '@src/shared/date/date-key';
import { H4, VStack } from '@src/shared/ui';

import { ImportFreePlanNotice } from './import-free-plan-notice';

interface ImportDateSheetProps {
  /** 시작일·종료일 중 무엇을 고르는지 */
  title: string;
  value: DateKey;
  onChange: (dateKey: DateKey) => void;
  minimum: DateKey;
  /** null이면 막지 않는다 */
  maximum: DateKey | null;
}

/** 날을 누르면 확인 없이 바로 고른다. 무료 플랜이면 고를 수 없는 날이 왜 막혔는지 아래에 적는다 */
export function ImportDateSheet({
  title,
  value,
  onChange,
  minimum,
  maximum,
}: ImportDateSheetProps) {
  const picker = useDatePicker({ initialDateKey: value });

  return (
    <VStack gap={16}>
      <H4 accessibilityRole="header">{title}</H4>
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
      <ImportFreePlanNotice />
    </VStack>
  );
}

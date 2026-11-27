import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { DatePickerCalendar } from '@src/features/planning/todo/components/todo-date-picker';
import { useDatePicker } from '@src/features/planning/todo/hooks/use-date-picker';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { H4, SettingsListGroup, useOpenSheet, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import {
  findLastAllowedDate,
  type TodoImportRange,
  TodoImportRangePolicy,
} from '../domains/todo-import-range.model';
import { ImportFreePlanNotice } from './import-free-plan-notice';

interface ImportRangeInputProps extends Omit<ComponentProps<typeof SettingsListGroup>, 'children'> {
  value: TodoImportRange;
  onChange: (range: TodoImportRange) => void;
}

// 가져올 기간의 첫날과 끝 날. 누르면 날짜 시트를 열고, 요금제 기간(서버 CALENDAR_IMPORT 한도)을 넘는 날은 시트가 막는다
export function ImportRangeInput({ value, onChange, ...props }: ImportRangeInputProps) {
  const { t } = useTranslation('todoImport');
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const openSheet = useOpenSheet();

  // 요금제를 아직 모르면 막지 않는다. 서버가 시작할 때 기간을 다시 확인한다
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());

  const lastAllowedDate = findLastAllowedDate(
    todayKey,
    snapshot == null ? null : EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT'),
  );
  const startLabel = formatYearAwareDateKeyLabel(value.startDate, todayKey, dateFormatContext);
  const endLabel = formatYearAwareDateKeyLabel(value.endDate, todayKey, dateFormatContext);

  const handleStartPress = async () => {
    const startDate = await openSheet<DateKey>((close) => (
      <ImportDateSheet
        title={t('range.start')}
        value={value.startDate}
        onChange={close}
        minimum={todayKey}
        maximum={lastAllowedDate}
      />
    ));
    if (startDate != null) {
      onChange(TodoImportRangePolicy.withStartDate(value, startDate));
    }
  };

  const handleEndPress = async () => {
    const endDate = await openSheet<DateKey>((close) => (
      <ImportDateSheet
        title={t('range.end')}
        value={value.endDate}
        onChange={close}
        minimum={value.startDate}
        maximum={lastAllowedDate}
      />
    ));
    if (endDate != null) {
      onChange(TodoImportRangePolicy.withEndDate(value, endDate));
    }
  };

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        label={t('range.start')}
        value={<SettingsListGroup.Value>{startLabel}</SettingsListGroup.Value>}
        accessibilityLabel={`${t('range.start')}, ${startLabel}`}
        onPress={handleStartPress}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item
        label={t('range.end')}
        value={<SettingsListGroup.Value>{endLabel}</SettingsListGroup.Value>}
        accessibilityLabel={`${t('range.end')}, ${endLabel}`}
        onPress={handleEndPress}
      />
    </SettingsListGroup>
  );
}

interface ImportDateSheetProps {
  // 첫날·끝 날 중 무엇을 고르는지
  title: string;
  value: DateKey;
  onChange: (dateKey: DateKey) => void;
  minimum: DateKey;
  // null이면 막지 않는다
  maximum: DateKey | null;
}

// 날을 누르면 확인 없이 바로 고른다. 무료 플랜이면 고를 수 없는 날이 왜 막혔는지 아래에 적는다
function ImportDateSheet({ title, value, onChange, minimum, maximum }: ImportDateSheetProps) {
  const picker = useDatePicker({ initialDateKey: value });

  return (
    <VStack gap={16}>
      <H4 accessibilityRole="header">{title}</H4>
      <DatePickerCalendar
        displayMonthKey={picker.displayMonthKey}
        weeks={picker.weeks}
        selectedDateKey={picker.selectedDateKey}
        onPreviousMonth={picker.goToPreviousMonth}
        onNextMonth={picker.goToNextMonth}
        onSelect={onChange}
        minimumDateKey={minimum}
        maximumDateKey={maximum ?? undefined}
      />
      <ImportFreePlanNotice />
    </VStack>
  );
}

import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import type { DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { ActionButton, HStack, LockIcon, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { IMPORT_RANGE_PRESETS, type ImportRangePreset } from '../constants/todo-import.constants';
import { canImportUntil, getRangeEndDate } from '../domains/todo-import.model';
import { findRangePreset, IMPORT_RANGE_PRESET_LABEL_KEYS } from '../utils/todo-import.view-model';
import { ImportFreePlanNotice } from './import-free-plan-notice';

interface ImportEndDateChipsProps {
  /** 칩은 이 날부터 센 기간의 마지막 날을 고른다 */
  startDate: DateKey;
  value: DateKey;
  onValueChange: (endDate: DateKey) => void;
  /** 칩 묶음(라디오 그룹)을 읽는 이름 */
  accessibilityLabel?: string;
}

/** 요금제 기간(서버 `CALENDAR_IMPORT.limit`)을 넘는 칩은 잠그고 누르면 프리미엄 안내를 연다 */
export function ImportEndDateChips({
  startDate,
  value,
  onValueChange,
  accessibilityLabel,
}: ImportEndDateChipsProps) {
  const todayKey = useTodayKey();
  const gate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });
  const { data: snapshot } = useSuspenseQuery(useGetEntitlementsQueryOptions());

  const horizonDays = EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT');
  const selectedPreset = findRangePreset({ startDate, endDate: value });
  const isLocked = (preset: ImportRangePreset) =>
    !canImportUntil(
      getRangeEndDate(startDate, IMPORT_RANGE_PRESETS[preset]),
      todayKey,
      horizonDays,
    );

  const handlePress = (preset: ImportRangePreset) => {
    if (isLocked(preset)) {
      gate.promptLimit();
      return;
    }
    onValueChange(getRangeEndDate(startDate, IMPORT_RANGE_PRESETS[preset]));
  };
  const toChipProps = (preset: ImportRangePreset) => ({
    preset,
    isSelected: selectedPreset === preset,
    isLocked: isLocked(preset),
    onPress: () => handlePress(preset),
  });

  return (
    <VStack gap={8}>
      {/* 화면 안이라 시트용 가로 스크롤 줄 대신 큰 글꼴에서 다음 줄로 넘긴다 */}
      <HStack
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        className="flex-wrap gap-2"
      >
        <ImportEndDateChips.Chip {...toChipProps('week')} />
        <ImportEndDateChips.Chip {...toChipProps('month')} />
        <ImportEndDateChips.Chip {...toChipProps('quarter')} />
        <ImportEndDateChips.Chip {...toChipProps('half')} />
        <ImportEndDateChips.Chip {...toChipProps('year')} />
      </HStack>
      <ImportFreePlanNotice onPremiumPress={() => gate.promptLimit()} />
    </VStack>
  );
}

interface ChipProps {
  preset: ImportRangePreset;
  isSelected: boolean;
  isLocked: boolean;
  onPress: () => void;
}

/** 할 일 일정 칩과 같은 ActionButton이다. 고르는 칩이라 라디오로 읽힌다 */
ImportEndDateChips.Chip = function Chip({ preset, isSelected, isLocked, onPress }: ChipProps) {
  const { t } = useTranslation('todoImport');
  const label = t(IMPORT_RANGE_PRESET_LABEL_KEYS[preset]);

  return (
    <ActionButton
      icon={isLocked && <ActionButton.Icon Icon={LockIcon} colorClassName="text-gray-6" />}
      label={label}
      isActive={isSelected}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={isLocked ? t('range.lockedPreset', { label }) : label}
    />
  );
};

ImportEndDateChips.Loading = function Loading() {
  return (
    <HStack className="flex-wrap gap-2">
      <ActionButton.Loading className="w-16" />
      <ActionButton.Loading className="w-20" />
      <ActionButton.Loading className="w-20" />
    </HStack>
  );
};

/** 기간 안내를 읽지 못해도 서버가 시작할 때 기간을 다시 확인해 칩만 숨긴다 */
ImportEndDateChips.Error = function ErrorFallback() {
  return null;
};

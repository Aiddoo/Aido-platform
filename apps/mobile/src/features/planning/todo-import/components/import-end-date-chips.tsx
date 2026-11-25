import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { ActionButton, HStack, LockIcon, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import {
  type TodoImportRange,
  TodoImportRangePolicy,
  type TodoImportRangePreset,
} from '../domains/todo-import-range.model';
import { getRangePresetLabelKey } from '../utils/todo-import.view-model';
import { ImportFreePlanNotice } from './import-free-plan-notice';

interface ImportEndDateChipsProps {
  // 칩은 첫날부터 센 기간의 끝 날을 고른다
  value: TodoImportRange;
  onChange: (range: TodoImportRange) => void;
  // 칩 묶음(라디오 그룹)을 읽는 이름
  accessibilityLabel?: string;
}

// 요금제 기간(서버 CALENDAR_IMPORT 한도)을 넘는 칩은 잠그고 누르면 프리미엄 안내를 연다
export function ImportEndDateChips({
  value,
  onChange,
  accessibilityLabel,
}: ImportEndDateChipsProps) {
  const todayKey = useTodayKey();
  const gate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });

  const { data: snapshot } = useSuspenseQuery(useGetEntitlementsQueryOptions());

  const horizonDays = EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT');
  const selectedPreset = TodoImportRangePolicy.findPreset(value);

  const getChipProps = (preset: TodoImportRangePreset) => {
    const isLocked = !TodoImportRangePolicy.canUsePreset(value, preset, todayKey, horizonDays);

    return {
      preset,
      isSelected: selectedPreset === preset,
      isLocked,
      onPress: () => {
        if (isLocked) {
          gate.promptLimit();
          return;
        }
        onChange(TodoImportRangePolicy.withPreset(value, preset));
      },
    };
  };

  return (
    <VStack gap={8}>
      {/* 화면 안이라 시트용 가로 스크롤 줄 대신 큰 글꼴에서 다음 줄로 넘긴다 */}
      <HStack
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        className="flex-wrap gap-2"
      >
        <ImportEndDateChips.Chip {...getChipProps('week')} />
        <ImportEndDateChips.Chip {...getChipProps('month')} />
        <ImportEndDateChips.Chip {...getChipProps('quarter')} />
        <ImportEndDateChips.Chip {...getChipProps('half')} />
        <ImportEndDateChips.Chip {...getChipProps('year')} />
      </HStack>
      {/* 누르는 영역이 줄 끝까지 늘어나지 않게 글 폭에 맞춘다 */}
      <ImportFreePlanNotice className="self-start" onPremiumPress={() => gate.promptLimit()} />
    </VStack>
  );
}

interface ChipProps extends Omit<
  ComponentProps<typeof ActionButton>,
  'icon' | 'label' | 'isActive' | 'accessibilityRole' | 'accessibilityState' | 'accessibilityLabel'
> {
  preset: TodoImportRangePreset;
  isSelected: boolean;
  isLocked: boolean;
}

// 할 일 일정 칩과 같은 ActionButton이다. 고르는 칩이라 라디오로 읽힌다
ImportEndDateChips.Chip = function Chip({ preset, isSelected, isLocked, ...props }: ChipProps) {
  const { t } = useTranslation('todoImport');
  const label = t(getRangePresetLabelKey(preset));

  return (
    <ActionButton
      {...props}
      icon={isLocked && <ActionButton.Icon Icon={LockIcon} colorClassName="text-gray-6" />}
      label={label}
      isActive={isSelected}
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

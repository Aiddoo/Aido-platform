import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { HStack, LockIcon, SheetChipRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, RadioGroup, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import { IMPORT_RANGE_PRESETS, type ImportRangePreset } from '../constants/todo-import.constants';
import { canImportUntil, findLastAllowedDate, getRangeEndDate } from '../domains/todo-import.model';
import {
  findRangePreset,
  IMPORT_RANGE_PRESET_LABEL_KEYS,
  toRangePreset,
} from '../utils/todo-import.view-model';

interface ImportEndDateChipsProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'children' | 'value' | 'onValueChange'
> {
  /** 칩은 이 날부터 센 기간의 마지막 날을 고른다 */
  startDate: DateKey;
  value: DateKey;
  onValueChange: (endDate: DateKey) => void;
}

const LOCK_ICON_SIZE = 14;

/**
 * 시작 날부터 1주·1개월·3개월·6개월·1년의 마지막 날을 고르는 칩. 요금제 기간(서버 `CALENDAR_IMPORT.limit`)을
 * 넘는 칩은 잠그고 누르면 프리미엄 안내를 연다. 무료에는 가져올 수 있는 마지막 날을 함께 알린다
 */
export function ImportEndDateChips({
  startDate,
  value,
  onValueChange,
  ...props
}: ImportEndDateChipsProps) {
  const { t } = useTranslation('todoImport');
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const gate = useEntitlementGate('CALENDAR_IMPORT', { surface: 'todo_import' });
  const { data: snapshot } = useSuspenseQuery(useGetEntitlementsQueryOptions());

  const horizonDays = EntitlementPolicy.findLimit(snapshot, 'CALENDAR_IMPORT');
  const lastAllowedDate = findLastAllowedDate(todayKey, horizonDays);
  const selectedPreset = findRangePreset({ startDate, endDate: value });
  const isLocked = (preset: ImportRangePreset) =>
    !canImportUntil(
      getRangeEndDate(startDate, IMPORT_RANGE_PRESETS[preset]),
      todayKey,
      horizonDays,
    );

  const handleValueChange = (nextValue: string) => {
    const preset = toRangePreset(nextValue);
    if (preset == null) {
      return;
    }
    if (isLocked(preset)) {
      gate.promptLimit();
      return;
    }
    onValueChange(getRangeEndDate(startDate, IMPORT_RANGE_PRESETS[preset]));
  };

  return (
    <VStack gap={8}>
      <SheetChipRow>
        <RadioGroup
          value={selectedPreset ?? ''}
          onValueChange={handleValueChange}
          className="flex-row items-center gap-2"
          {...props}
        >
          <ImportEndDateChips.Chip preset="week" isLocked={isLocked('week')} />
          <ImportEndDateChips.Chip preset="month" isLocked={isLocked('month')} />
          <ImportEndDateChips.Chip preset="quarter" isLocked={isLocked('quarter')} />
          <ImportEndDateChips.Chip preset="half" isLocked={isLocked('half')} />
          <ImportEndDateChips.Chip preset="year" isLocked={isLocked('year')} />
        </RadioGroup>
      </SheetChipRow>

      {EntitlementPolicy.shouldOfferPremium(snapshot) && lastAllowedDate != null && (
        <PressableFeedback
          accessibilityRole="button"
          accessibilityHint={t('range.freeUntilHint')}
          onPress={() => gate.promptLimit()}
          className="self-start"
        >
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('range.freeUntil', {
              date: formatYearAwareDateKeyLabel(lastAllowedDate, todayKey, dateFormatContext),
            })}
          </Text>
        </PressableFeedback>
      )}
    </VStack>
  );
}

interface ChipProps {
  preset: ImportRangePreset;
  /** 요금제 기간보다 길다. 고르면 안내를 연다 */
  isLocked: boolean;
}

ImportEndDateChips.Chip = function Chip({ preset, isLocked }: ChipProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const label = t(IMPORT_RANGE_PRESET_LABEL_KEYS[preset]);

  return (
    <RadioGroup.Item
      value={preset}
      accessibilityLabel={isLocked ? t('range.lockedPreset', { label }) : label}
    >
      {({ isSelected }) => (
        <HStack
          align="center"
          gap={4}
          className={cn(
            'h-9 rounded-full border px-3.5',
            isSelected ? 'border-main bg-main/10' : 'border-gray-3 bg-white dark:bg-gray-1',
          )}
        >
          {isLocked && (
            <LockIcon
              width={fontScaledSize(LOCK_ICON_SIZE)}
              height={fontScaledSize(LOCK_ICON_SIZE)}
              colorClassName="text-gray-6"
            />
          )}
          <Text
            size="b3"
            weight={isSelected ? 'semibold' : 'normal'}
            tone={isSelected ? 'brand' : 'neutral'}
            shade={isSelected ? undefined : 8}
            numberOfLines={1}
          >
            {label}
          </Text>
        </HStack>
      )}
    </RadioGroup.Item>
  );
};

ImportEndDateChips.Loading = function Loading() {
  return (
    <VStack gap={8}>
      <HStack gap={8}>
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </HStack>
      <TextSkeleton size="b4" className="w-48" />
    </VStack>
  );
};

/** 기간 안내를 읽지 못해도 서버가 시작할 때 기간을 다시 확인해 칩만 숨긴다 */
ImportEndDateChips.Error = function ErrorFallback() {
  return null;
};

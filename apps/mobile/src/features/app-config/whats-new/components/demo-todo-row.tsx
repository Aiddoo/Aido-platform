import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoCheckbox, TodoLabel, TodoRow } from '@src/features/planning/todo/components/todo-row';
import { formatTimeOfDay, type TimeOfDay } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { EditIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

/** 실제 고르기 시트(PlanReview)의 카드와 같은 값이다 */
const UNSELECTED_TITLE_CLASS_NAME = 'text-gray-8 dark:text-gray-6';
const PLAN_CARD_CLASS_NAME = 'flex-1 rounded-2xl bg-gray-1 px-4 py-3 dark:bg-gray-2';
const SELECT_GAP = 12;
const EDIT_ICON_SIZE = 16;

interface DemoTodoRowProps extends Omit<
  ComponentProps<typeof TodoRow>,
  'left' | 'top' | 'middle' | 'bottom'
> {
  title: string;
  time: TimeOfDay | null;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  /** 고르기 시트는 체크가 "추가할 것"이고, 목록은 체크가 "끝냄"이라 줄을 긋는다 */
  surface: 'plan' | 'list';
}

export function DemoTodoRow({
  title,
  time,
  isSelected,
  onSelectedChange,
  surface,
  ...rowProps
}: DemoTodoRowProps) {
  const { t } = useTranslation('voicePlan');
  const dateFormatContext = useDateFormatContext();
  const fontScaledSize = useFontScaledSize();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const timeLabel =
    time == null
      ? null
      : formatTimeOfDay(time, preference?.timeFormat ?? 'TWELVE_HOUR', dateFormatContext);
  const timeText = timeLabel != null && (
    <Text size="e1" shade={6} className="tabular-nums">
      {timeLabel}
    </Text>
  );

  return match(surface)
    .with('plan', () => (
      <HStack gap={SELECT_GAP} align="center">
        <TodoCheckbox
          accessibilityLabel={t('plan.select', { title })}
          hitSlop={SELECT_GAP}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
        />
        <HStack gap={12} align="center" className={PLAN_CARD_CLASS_NAME}>
          <VStack flex={1} gap={2}>
            <TodoLabel
              isCompleted={false}
              lineBreakStrategyIOS="hangul-word"
              className={cn(!isSelected && UNSELECTED_TITLE_CLASS_NAME)}
            >
              {title}
            </TodoLabel>
            {timeText}
          </VStack>
          <EditIcon
            width={fontScaledSize(EDIT_ICON_SIZE)}
            height={fontScaledSize(EDIT_ICON_SIZE)}
            colorClassName="text-main"
          />
        </HStack>
      </HStack>
    ))
    .with('list', () => (
      <TodoRow
        {...rowProps}
        left={
          <TodoCheckbox
            accessibilityLabel={title}
            hitSlop={SELECT_GAP}
            isSelected={isSelected}
            onSelectedChange={onSelectedChange}
          />
        }
        top={<TodoLabel isCompleted={isSelected}>{title}</TodoLabel>}
        middle={timeText}
      />
    ))
    .exhaustive();
}

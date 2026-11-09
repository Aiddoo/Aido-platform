import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoCheckbox, TodoLabel, TodoRow } from '@src/features/planning/todo/components/todo-row';
import { formatTimeOfDay, type TimeOfDay } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

/** 고르기 화면의 고르지 않은 행 제목. 실제 고르기 화면과 같은 값이다 */
const UNSELECTED_TITLE_CLASS_NAME = 'text-gray-7 dark:text-gray-5';
const SELECT_HIT_SLOP = 12;

interface DemoTodoRowProps extends Omit<
  ComponentProps<typeof TodoRow>,
  'left' | 'top' | 'middle' | 'bottom'
> {
  title: string;
  time: TimeOfDay | null;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  /** 고르기 화면은 체크가 "추가할 것"이고, 목록은 체크가 "끝냄"이라 줄을 긋는다 */
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
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const timeLabel =
    time == null
      ? null
      : formatTimeOfDay(time, preference?.timeFormat ?? 'TWELVE_HOUR', dateFormatContext);

  return (
    <TodoRow
      {...rowProps}
      left={
        <TodoCheckbox
          accessibilityLabel={surface === 'plan' ? t('plan.select', { title }) : title}
          hitSlop={SELECT_HIT_SLOP}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
        />
      }
      top={match(surface)
        .with('plan', () => (
          <TodoLabel isCompleted={false} className={cn(!isSelected && UNSELECTED_TITLE_CLASS_NAME)}>
            {title}
          </TodoLabel>
        ))
        .with('list', () => <TodoLabel isCompleted={isSelected}>{title}</TodoLabel>)
        .exhaustive()}
      middle={
        timeLabel != null && (
          <Text size="e1" shade={6} className="tabular-nums">
            {timeLabel}
          </Text>
        )
      }
    />
  );
}

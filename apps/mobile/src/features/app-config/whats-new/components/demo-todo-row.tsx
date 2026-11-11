import { USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import {
  TodoCheckbox,
  TodoLabel,
  TodoProgress,
  TodoRow,
  TodoScheduleLine,
  TodoTitleLine,
} from '@src/features/planning/todo/components/todo-row';
import {
  isPrivateVisibility,
  isRecurring,
  type Todo,
} from '@src/features/planning/todo/domains/todo.model';
import type { PlanTodoFormValues } from '@src/features/voice/schemas/plan-review-form.schema';
import { getPlanTodoSubtitle } from '@src/features/voice/utils/plan-todo-subtitle.view-model';
import { formatTimeOfDay } from '@src/shared/date/format/date-format';
import { toTimeOfDay } from '@src/shared/date/time-of-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { EditIcon, HStack, SurfaceCard, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

/** 실제 고르기 시트(PlanReview)의 카드와 같은 값이다 */
const UNSELECTED_TITLE_CLASS_NAME = 'text-gray-8 dark:text-gray-6';
const PLAN_CARD_CLASS_NAME = 'flex-1 flex-row items-center gap-3 px-4 py-3';
const SELECT_GAP = 12;
const EDIT_ICON_SIZE = 16;

/** 고르기 시트의 카드 값과, 저장된 뒤 목록이 반복을 알아보는 묶음 id */
export type DemoTodo = Pick<
  PlanTodoFormValues,
  'title' | 'startDate' | 'endDate' | 'scheduledTime' | 'repeat' | 'visibility' | 'items'
> &
  Pick<Todo, 'recurrenceGroupId'>;

interface DemoTodoRowProps extends Omit<
  ComponentProps<typeof TodoRow>,
  'left' | 'top' | 'middle' | 'bottom'
> {
  todo: DemoTodo;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  /** 고르기 시트는 체크가 "추가할 것"이고, 목록은 체크가 "끝냄"이라 줄을 긋는다 */
  surface: 'plan' | 'list';
}

export function DemoTodoRow({
  todo,
  isSelected,
  onSelectedChange,
  surface,
  ...rowProps
}: DemoTodoRowProps) {
  const { t } = useTranslation('voicePlan');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const fontScaledSize = useFontScaledSize();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const timeFormat = preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT;
  const isPrivate = isPrivateVisibility(todo.visibility);

  return match(surface)
    .with('plan', () => {
      const subtitle = getPlanTodoSubtitle(todo, { todayKey, timeFormat, dateFormatContext });
      const unselectedClassName = !isSelected && UNSELECTED_TITLE_CLASS_NAME;

      return (
        <HStack gap={SELECT_GAP} align="center">
          <TodoCheckbox
            accessibilityLabel={t('plan.select', { title: todo.title })}
            hitSlop={SELECT_GAP}
            isSelected={isSelected}
            onSelectedChange={onSelectedChange}
          />
          <SurfaceCard surface="sheet" className={PLAN_CARD_CLASS_NAME}>
            <VStack flex={1} gap={2}>
              <TodoTitleLine
                label={
                  <TodoLabel
                    isCompleted={false}
                    lineBreakStrategyIOS="hangul-word"
                    className={cn('flex-1', unselectedClassName)}
                  >
                    {todo.title}
                  </TodoLabel>
                }
                isPrivate={isPrivate}
              />
              {subtitle != null && (
                <Text size="e1" shade={6}>
                  {subtitle}
                </Text>
              )}
              {todo.items.length > 0 && (
                <VStack gap={2} className="mt-1 border-l border-gray-3 pl-3">
                  {todo.items.map((item) => (
                    <Text
                      key={item.title}
                      size="b4"
                      shade={7}
                      lineBreakStrategyIOS="hangul-word"
                      className={cn(unselectedClassName)}
                    >
                      {item.title}
                    </Text>
                  ))}
                </VStack>
              )}
            </VStack>
            <EditIcon
              width={fontScaledSize(EDIT_ICON_SIZE)}
              height={fontScaledSize(EDIT_ICON_SIZE)}
              colorClassName="text-main"
            />
          </SurfaceCard>
        </HStack>
      );
    })
    .with('list', () => {
      const timeLabel =
        todo.scheduledTime == null
          ? null
          : formatTimeOfDay(toTimeOfDay(todo.scheduledTime), timeFormat, dateFormatContext);

      return (
        <TodoRow
          {...rowProps}
          left={
            <TodoCheckbox
              accessibilityLabel={todo.title}
              hitSlop={SELECT_GAP}
              isSelected={isSelected}
              onSelectedChange={onSelectedChange}
            />
          }
          top={
            <TodoTitleLine
              label={
                <TodoLabel isCompleted={isSelected} className="flex-1">
                  {todo.title}
                </TodoLabel>
              }
              isPrivate={isPrivate}
            />
          }
          middle={
            timeLabel != null || isRecurring(todo.recurrenceGroupId) ? (
              <TodoScheduleLine todo={todo} timeLabel={timeLabel} />
            ) : undefined
          }
          bottom={
            todo.items.length > 0 ? <TodoProgress value={0} total={todo.items.length} /> : undefined
          }
        />
      );
    })
    .exhaustive();
}

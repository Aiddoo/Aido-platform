import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { CategoryHeaderPill } from '@src/features/planning/category/components/category-header-pill';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';

import { TodoPolicy } from '../domains/todo.model';
import { useTodoId } from '../hooks/use-todo-params';
import {
  useGetTodoDetailsQueryOptions,
  useGetTodosByDateQueryOptions,
} from '../queries/todo.queries';
import { formatTodoPeriod } from '../utils/todo-period.view-model';
import { formatRepeatSummary } from '../utils/todo-repeat-summary.view-model';
import { formatTodoTime } from '../utils/todo-time.view-model';

/** 할 일 상세의 시간·반복·카테고리·날짜 줄. 상세 본문의 경계 하나에 묶여 함께 기다린다 */
export function TodoDetailSchedule() {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const [{ data: detail }, { data: preference }] = useSuspenseQueries({
    queries: [useGetTodoDetailsQueryOptions({ todoId }), useGetPreferenceQueryOptions()],
  });
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const { todo } = detail;
  const timeLabel = formatTodoTime(todo, preference.timeFormat, dateFormatContext);
  const isRecurring = TodoPolicy.isRecurringTodo(todo);
  const dateLabel = formatTodoPeriod(todo, todayKey, dateFormatContext);

  return (
    <VStack gap={6}>
      {(timeLabel != null || isRecurring) && (
        <HStack gap={4} align="center" wrap="wrap">
          {timeLabel != null && (
            <Text size="b4" shade={6}>
              {timeLabel}
            </Text>
          )}
          {timeLabel != null && isRecurring && (
            <Text size="b4" shade={6}>
              ·
            </Text>
          )}
          {isRecurring &&
            (detail.permissions.canEdit ? (
              <OwnRepeatLabel />
            ) : (
              <Text size="b4" shade={6}>
                {t('chip.repeat')}
              </Text>
            ))}
        </HStack>
      )}
      <HStack gap={8} align="center" wrap="wrap">
        <CategoryHeaderPill
          label={todo.category.name}
          color={todo.category.color}
          className="self-start"
        />
        <Text size="e1" shade={6}>
          {dateLabel}
        </Text>
      </HStack>
    </VStack>
  );
}

/** 상세 응답에는 반복 규칙이 없어 시작일 목록에서 읽는다. 받기 전이나 실패하면 반복이라고만 보인다 */
function OwnRepeatLabel() {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const { data: list } = useQuery(useGetTodosByDateQueryOptions({ date: detail.todo.startDate }));
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const repeat = list?.todos.find((todo) => todo.id === todoId)?.repeat;

  return (
    <Text size="b4" shade={6} className="shrink">
      {repeat == null ? t('chip.repeat') : formatRepeatSummary(repeat, todayKey, dateFormatContext)}
    </Text>
  );
}

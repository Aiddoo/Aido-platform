import type { ToggleTodoCompleteInput } from '@aido/api';
import {
  useActivationService,
  useHaptics,
  useTodoService,
} from '@src/bootstrap/providers/di-context';
import { invalidateWeeklyAchievements } from '@src/features/achievement/queries/achievement-cache';
import { recordTodoCompletionForActivation } from '@src/features/activation/queries/activation-cache';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { useStoreReviewMoment } from '@src/features/store-review/hooks/use-store-review-moment';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { toDate } from '@src/shared/utils/date';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { TodoPolicy } from '../domains/todo.model';
import {
  cancelTodoListQuery,
  getCachedTodosByDate,
  invalidateTodoCompletions,
  invalidateTodoDetails,
  snapshotTodo,
  updateTodoInList,
} from './todo-cache';

interface ToggleTodoMutationParams {
  todoId: number;
  body: ToggleTodoCompleteInput;
  /** 체크한 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export const useToggleTodoMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const todayKey = useTodayKey();
  const { recordActiveDay, requestReviewAt } = useStoreReviewMoment();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.toggle(),
    mutationFn: async ({ todoId, body }: ToggleTodoMutationParams) => {
      const result = await todoService.toggleTodoComplete(todoId, body);
      return unwrap(result);
    },
    onMutate: async ({ todoId, body, date }) => {
      await cancelTodoListQuery(queryClient, { date });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      updateTodoInList(queryClient, { date, todoId }, (todo) => ({
        ...todo,
        completed: body.completed,
      }));

      return { completed: snapshot?.todo.completed, date };
    },
    onSuccess: (_data, variables) => {
      trackEvent('todo_completed', {
        todo_id: variables.todoId,
        is_completed: variables.body.completed,
      });
      const activationEvent = recordTodoCompletionForActivation({
        queryClient,
        service: activationService,
        isCompleted: variables.body.completed,
      });
      if (activationEvent) {
        trackEvent('activation_completed', activationEvent);
      }
      if (!variables.body.completed) {
        return;
      }
      recordActiveDay();
      // 오늘 목록의 마지막 할 일을 끝낸 순간 — 피드의 '다 끝낸 날' 배너와 같은 순간이다
      const todayTodos = getCachedTodosByDate(queryClient, { date: todayKey }) ?? [];
      if (TodoPolicy.completesAll(todayTodos, variables.todoId)) {
        requestReviewAt('all_todos_done');
      }
    },
    onError: (_error, variables, context) => {
      haptics.notify('error');

      const previousCompleted = context?.completed;
      // 완료 여부만 되돌려 같은 할 일의 서브투두 변경은 지키게 한다
      if (context && previousCompleted != null) {
        updateTodoInList(queryClient, { date: context.date, todoId: variables.todoId }, (todo) => ({
          ...todo,
          completed: previousCompleted,
        }));
      }
    },
    onSettled: (_data, _error, { date, todoId }) => {
      invalidateTodoDetails(queryClient, { todoId });
      if (date < todayKey) {
        invalidateWeeklyAchievements(queryClient, { year: toDate(date).getFullYear() });
      }
      // 연달아 체크하면 앞선 응답의 재조회가 뒤 체크의 낙관적 값을 덮어 깜빡인다. 마지막 체크가 끝날 때만 맞춘다
      if (queryClient.isMutating({ mutationKey: TODO_MUTATION_KEYS.toggle() }) !== 1) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
      invalidateTodoCompletions(queryClient);
      invalidateNudgeInteractions(queryClient);
    },
  });
};

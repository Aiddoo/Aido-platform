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
import { TodoPolicy } from '../domains/todo.model';
import {
  cancelTodoCompletionQueries,
  getCachedTodosByDate,
  settleTodoCompletionWrite,
  syncDailyCompletionWithList,
  updateCachedTodo,
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
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, body }: ToggleTodoMutationParams) => {
      const result = await todoService.toggleTodoComplete(todoId, body);
      return unwrap(result);
    },
    onMutate: async ({ todoId, body, date }) => {
      await cancelTodoCompletionQueries(queryClient, { date, todoId });
      updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
        ...todo,
        completed: body.completed,
      }));
      syncDailyCompletionWithList(queryClient, { date });
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
      if (TodoPolicy.completesAllTodos(todayTodos, variables.todoId)) {
        requestReviewAt('all_todos_done');
      }
    },
    onError: (_error, { todoId, body, date }) => {
      haptics.notify('error');
      // 완료 여부만 되돌려 같은 할 일의 서브투두 변경은 지키게 한다
      updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
        ...todo,
        completed: !body.completed,
      }));
      syncDailyCompletionWithList(queryClient, { date });
    },
    onSettled: (_data, _error, { date }) => {
      if (date < todayKey) {
        invalidateWeeklyAchievements(queryClient, { year: toDate(date).getFullYear() });
      }
      invalidateNudgeInteractions(queryClient);
      settleTodoCompletionWrite(queryClient);
    },
  });
};

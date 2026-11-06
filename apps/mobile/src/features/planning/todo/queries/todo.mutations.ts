import type {
  ToggleTodoCompleteInput,
  ChangeTodoCategoryInput,
  ReorderTodoInput,
  UpdateTodoScheduleInput,
} from '@aido/api';
import {
  useActivationService,
  useHaptics,
  useTodoService,
} from '@src/bootstrap/providers/di-context';
import { recordTodoCompletionForActivation } from '@src/features/device/activation/queries/activation-cache';
import { useStoreReviewMoment } from '@src/features/device/store-review/hooks/use-store-review-moment';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { invalidateWeeklyAchievements } from '@src/features/insights/achievement/queries/achievement-cache';
import { invalidateTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/nudge-cache';
import { useTrack } from '@src/shared/analytics';
import { toDate } from '@src/shared/date/instant';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import type { TodoUpdateScope, TodoEditScope } from '../domains/todo-repeat.model';
import { TodoPolicy } from '../domains/todo.model';
import {
  cancelTodoCompletionQueries,
  getCachedTodosByDate,
  settleTodoCompletionWrite,
  syncDailyCompletionWithList,
  updateCachedTodo,
  invalidateTodos,
  removeTodoFromList,
  restoreTodo,
  snapshotTodo,
  invalidateWidgetSummary,
  settleTodoListWrite,
} from './todo-cache';
import { useTodoSeriesFailureHandler } from './todo-series.mutations';

interface ToggleTodoMutationParams {
  todoId: number;
  body: ToggleTodoCompleteInput;
  /** 체크한 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useToggleTodoMutationOptions() {
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
}

interface ChangeTodoCategoryMutationParams {
  todoId: number;
  input: ChangeTodoCategoryInput;
  scope?: TodoUpdateScope;
}

export function useChangeTodoCategoryMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input, scope }: ChangeTodoCategoryMutationParams) => {
      const result = await todoService.changeTodoCategory(todoId, input, scope);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.categoryChanged'));
      trackEvent('todo_edited', { todo_id: variables.todoId, field: 'categoryId' });
      if (variables.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.scope });
      }
    },
    onError: (error) => {
      haptics.notify('error');

      if (handleSeriesFailure(error)) {
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.changeFailedRetry') });
    },
  });
}

interface DeleteTodoMutationParams {
  todoId: number;
  /** 지운 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
  scope?: TodoEditScope;
}

export function useDeleteTodoMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, scope }: DeleteTodoMutationParams) => {
      const result = await todoService.deleteTodo(todoId, scope);
      return unwrap(result);
    },
    onMutate: async ({ todoId, date }) => {
      await cancelTodoCompletionQueries(queryClient, { date, todoId });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      removeTodoFromList(queryClient, { date, todoId });
      syncDailyCompletionWithList(queryClient, { date });

      return { snapshot };
    },
    onSuccess: (_, { todoId, scope }) => {
      toast.success(t('todo:toast.todoDeleted'));
      trackEvent('todo_deleted', { todo_id: todoId });
      if (scope != null) {
        trackEvent('todo_series_deleted', { scope });
        invalidateTodos(queryClient);
      }
    },
    onError: (error, _variables, context) => {
      haptics.notify('error');

      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
        syncDailyCompletionWithList(queryClient, { date: context.snapshot.date });
      }

      if (handleSeriesFailure(error)) {
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.deleteFailedRetry') });
    },
    onSettled: () => {
      invalidateTodoCategories(queryClient);
      invalidateNudgeInteractions(queryClient);
      settleTodoCompletionWrite(queryClient);
    },
  });
}

interface ReorderTodoParams {
  id: number;
  input: ReorderTodoInput;
}

export function useReorderTodoMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ id, input }: ReorderTodoParams) => {
      const result = await todoService.reorderTodo(id, input);
      return unwrap(result);
    },
    onSuccess: () => {
      invalidateWidgetSummary(queryClient);
      trackEvent('todo_reordered', { source: 'feed' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_reorder' });
      }
    },
    onError: () => {
      haptics.notify('error');
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
}

export interface UpdateTodoScheduleMutationParams {
  todoId: number;
  input: UpdateTodoScheduleInput;
  /** 사용자가 고친 칸. 저장 안내 문구를 고른다. 안내를 따로 띄우는 곳(날씨 일괄 옮기기)은 넘기지 않는다 */
  changedField?: 'date' | 'time';
  scope?: TodoUpdateScope;
}

export function useUpdateTodoScheduleMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const handleSeriesFailure = useTodoSeriesFailureHandler();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input, scope }: UpdateTodoScheduleMutationParams) => {
      const result = await todoService.updateTodoSchedule(todoId, input, scope);
      return unwrap(result);
    },
    onSuccess: (_data, { changedField, scope }) => {
      invalidateTodos(queryClient);
      invalidateNudgeInteractions(queryClient);
      toast.success(
        changedField === 'time' ? t('todo:toast.timeChanged') : t('todo:toast.dateChanged'),
      );
      if (scope != null) {
        trackEvent('todo_series_edited', { scope });
      }
    },
    onError: (error) => {
      haptics.notify('error');

      if (handleSeriesFailure(error)) {
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.updateFailedRetry') });
    },
  });
}

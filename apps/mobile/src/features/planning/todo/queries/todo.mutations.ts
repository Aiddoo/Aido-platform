import { useHaptics, useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { useStoreReviewMoment } from '@src/features/device/store-review/hooks/use-store-review-moment';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { invalidateWeeklyAchievements } from '@src/features/insights/achievement/queries/achievement-cache';
import {
  changeCachedCategoryTodoCount,
  invalidateTodoCategories,
} from '@src/features/planning/category/queries/todo-category-cache';
import { useTrack } from '@src/shared/analytics';
import { getIsoWeekYear, type DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { TodoUpdateScope, TodoEditScope } from '../domains/todo-repeat.model';
import {
  findTodoSeriesFailure,
  getTodoSeriesLimit,
  isTodoSeriesFailure,
  shouldRefreshTodos,
} from '../domains/todo-series.error';
import { TodoPolicy } from '../domains/todo.model';
import type {
  ChangeTodoCategoryInput,
  ReorderTodoInput,
  ToggleTodoCompleteInput,
  UpdateTodoScheduleInput,
} from '../schemas/todo-request.schema';
import {
  beginTodoWrite,
  getCachedTodosByDate,
  findCachedTodo,
  getCachedTodoDateSpan,
  getTodoOverviewFilters,
  invalidateTodoDependentQueries,
  invalidateTodos,
  removeTodoFromList,
  restoreTodo,
  settleTodoEdit,
  settleTodoReorder,
  settleTodoWrite,
  snapshotTodo,
  syncDailyCompletionWithList,
  updateCachedTodo,
  updateCachedTodoOverview,
  withTodoCompleted,
} from './todo-cache';
import { TODO_MUTATION_KEYS } from './todo-mutation-keys';
import { TODO_QUERY_KEYS } from './todo-query-keys';

interface ToggleTodoVariables {
  todoId: number;
  body: ToggleTodoCompleteInput;
  /** 체크한 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useToggleTodoMutationOptions() {
  const todoApi = useTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const todayKey = useTodayKey();
  const { recordActiveDay, requestReviewAt } = useStoreReviewMoment();

  return mutationOptions({
    // 응답까지 이 체크박스가 꺼진다. 오프라인에 멈춰 두면 연결될 때까지 꺼진 채 남으니 바로 실패해 되돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, body }: ToggleTodoVariables) => {
      const result = await todoApi.toggleTodoComplete(todoId, body);
      return unwrap(result);
    },
    onMutate: async ({ todoId, body, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: true,
      });
      const span = getCachedTodoDateSpan(queryClient, { date, todoId });
      updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
        ...todo,
        completed: body.completed,
      }));
      syncDailyCompletionWithList(queryClient, { date });

      return { ticket, span };
    },
    onSuccess: (saved, variables) => {
      const target = { date: variables.date, todoId: variables.todoId };
      // 그사이 다른 조회가 낡은 완료 값을 썼으면 서버 값으로 고친다. 앞 체크의 응답은 뒤에 누른 체크를 덮지 않게 마지막만 쓰고,
      // 값이 같으면 쓰지 않는다. 쓰면 함께 끝난 제목 저장이 남긴 낡음 표시가 지워져 그 목록을 다시 받지 않는다
      if (
        isLastMutation(queryClient, TODO_MUTATION_KEYS.listWrites()) &&
        findCachedTodo(queryClient, target)?.completed !== saved.completed
      ) {
        updateCachedTodo(queryClient, target, (todo) => ({ ...todo, completed: saved.completed }));
        syncDailyCompletionWithList(queryClient, { date: variables.date });
      }
      trackEvent('todo_completed', {
        todo_id: variables.todoId,
        is_completed: variables.body.completed,
      });
      emitTodoCompletionChanged({ isCompleted: variables.body.completed });
      if (!variables.body.completed) {
        return;
      }
      updateCachedTodoOverview(queryClient, withTodoCompleted);
      recordActiveDay();
      // 오늘 목록의 마지막 할 일을 끝낸 순간 — 피드의 '다 끝낸 날' 배너와 같은 순간이다
      const todayTodos = getCachedTodosByDate(queryClient, { date: todayKey }) ?? [];
      if (TodoPolicy.isLastOpenTodo(todayTodos, variables.todoId)) {
        requestReviewAt('all_todos_done');
      }
    },
    onError: (_error, { todoId, body, date }) => {
      // 완료 여부만 되돌려 같은 할 일의 서브투두 변경은 지키게 한다
      updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
        ...todo,
        completed: !body.completed,
      }));
      syncDailyCompletionWithList(queryClient, { date });
    },
    onSettled: (_data, error, { todoId, body, date }, context) => {
      // 주간 달성(목록·상세)은 서버가 주간 알림 때 저장한 값이라 할 일을 바꿔도 바로 다시 계산되지 않는다. 지우기·일정 옮기기도 다시 받지 않는다
      if (date < todayKey) {
        invalidateWeeklyAchievements(queryClient, { year: getIsoWeekYear(date) });
      }
      invalidateTodoDependentQueries(queryClient);
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        isCompletionAffected: true,
        hasFailed: error != null,
        ticket: context?.ticket,
        // 완료를 풀면 완료한 할 일이 하나도 남지 않았는지 서버만 안다
        extra: body.completed ? [] : getTodoOverviewFilters(),
      });
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.changeFailedRetry' } },
  });
}

interface ChangeTodoCategoryVariables {
  todoId: number;
  input: ChangeTodoCategoryInput;
  scope?: TodoUpdateScope;
}

export function useChangeTodoCategoryMutationOptions() {
  const todoApi = useTodoApi();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에 멈춰 두면 카테고리 변경 버튼이 로딩만 돈다. 바로 실패해 안내한다
    networkMode: 'always',
    // 저장을 기다리는 시트라 낙관적으로 쓰지 않는다. 다른 체크의 낙관적 값을 재조회로 덮지 않게 같은 키로 센다
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, input, scope }: ChangeTodoCategoryVariables) => {
      const result = await todoApi.changeTodoCategory(todoId, input, scope);
      return unwrap(result);
    },
    onMutate: ({ todoId }) => ({ before: findCachedTodo(queryClient, { todoId }) }),
    onSuccess: (saved, variables, { before }) => {
      // 이후 회차까지 바꾸면 바뀐 날짜를 몰라 넓게 맞춘다
      if (variables.scope == null) {
        settleTodoEdit(queryClient, { before, after: saved });
      } else {
        invalidateTodos(queryClient);
      }
      toast.success(t('todo:toast.categoryChanged'));
      trackEvent('todo_edited', { todo_id: variables.todoId, field: 'categoryId' });
      if (variables.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.scope });
      }
    },
    onError: (error) => {
      const seriesFailure = findTodoSeriesFailure(error);
      if (seriesFailure != null) {
        haptics.notify('error');
        if (shouldRefreshTodos(seriesFailure)) {
          invalidateTodos(queryClient);
        }
        toast.error(
          t(`todo:toast.series.${seriesFailure}.title`, {
            limit: getTodoSeriesLimit(error),
          }),
          { description: t(`todo:toast.series.${seriesFailure}.description`) },
        );
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.changeFailedRetry',
        isHandledByFeature: isTodoSeriesFailure,
      },
    },
  });
}

interface DeleteTodoVariables {
  todoId: number;
  /** 지운 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
  scope?: TodoEditScope;
}

export function useDeleteTodoMutationOptions() {
  const todoApi = useTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    // 오프라인에 멈춰 두면 삭제 중 표시가 끝나지 않는다. 바로 실패해 안내하고 낙관 삭제를 되돌린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, scope }: DeleteTodoVariables) => {
      const result = await todoApi.deleteTodo(todoId, scope);
      return unwrap(result);
    },
    onMutate: async ({ todoId, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: true,
      });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      const span = getCachedTodoDateSpan(queryClient, { date, todoId });
      removeTodoFromList(queryClient, { date, todoId });
      syncDailyCompletionWithList(queryClient, { date });

      return { snapshot, span, ticket };
    },
    onSuccess: (_, { todoId, scope }, context) => {
      toast.success(t('todo:toast.todoDeleted'));
      trackEvent('todo_deleted', { todo_id: todoId });
      if (scope != null) {
        trackEvent('todo_series_deleted', { scope });
        invalidateTodos(queryClient);
        return;
      }
      const categoryId = context.snapshot?.todo.category.id;
      if (categoryId == null) {
        invalidateTodoCategories(queryClient);
        return;
      }
      changeCachedCategoryTodoCount(queryClient, { categoryId, delta: -1 });
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        restoreTodo(queryClient, context.snapshot);
        syncDailyCompletionWithList(queryClient, { date: context.snapshot.date });
      }

      const seriesFailure = findTodoSeriesFailure(error);
      if (seriesFailure != null) {
        haptics.notify('error');
        if (shouldRefreshTodos(seriesFailure)) {
          invalidateTodos(queryClient);
        }
        toast.error(
          t(`todo:toast.series.${seriesFailure}.title`, {
            limit: getTodoSeriesLimit(error),
          }),
          { description: t(`todo:toast.series.${seriesFailure}.description`) },
        );
      }
    },
    onSettled: (_data, error, { todoId, date }, context) => {
      invalidateTodoDependentQueries(queryClient);
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        isCompletionAffected: true,
        hasFailed: error != null,
        ticket: context?.ticket,
        extra: [
          // 마지막 할 일·반복 회차를 지웠는지는 서버만 안다
          ...getTodoOverviewFilters(),
          { queryKey: TODO_QUERY_KEYS.page({ todoId }) },
        ],
      });
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.deleteFailedRetry',
        isHandledByFeature: isTodoSeriesFailure,
      },
    },
  });
}

interface ReorderTodoVariables {
  id: number;
  input: ReorderTodoInput;
}

export function useReorderTodoMutationOptions() {
  const todoApi = useTodoApi();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    // 저장하는 동안 목록이 끌기 전 순서를 붙잡는다. 오프라인에 멈춰 두면 연결될 때까지 묶이니 바로 실패해 제자리로 돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ id, input }: ReorderTodoVariables) => {
      const result = await todoApi.reorderTodo(id, input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('todo_reordered', { source: 'feed' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_reorder' });
      }
    },
    onSettled: (_data, _error, { id }) => {
      settleTodoReorder(queryClient, { todoId: id });
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.changeFailedRetry' } },
  });
}

export interface UpdateTodoScheduleVariables {
  todoId: number;
  input: UpdateTodoScheduleInput;
  /** 사용자가 고친 칸. 저장 안내 문구를 고른다. 안내를 따로 띄우는 곳(날씨 일괄 옮기기)은 넘기지 않는다 */
  changedField?: 'date' | 'time';
  scope?: TodoUpdateScope;
}

export function useUpdateTodoScheduleMutationOptions() {
  const todoApi = useTodoApi();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에 멈추면 저장 중인 시트가 잠긴 채 남고 연결되는 순간 일정이 바뀐다. 바로 실패해 안내한다
    networkMode: 'always',
    // 저장을 기다리는 시트라 낙관적으로 쓰지 않는다. 다른 체크의 낙관적 값을 재조회로 덮지 않게 같은 키로 센다
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, input, scope }: UpdateTodoScheduleVariables) => {
      const result = await todoApi.updateTodoSchedule(todoId, input, scope);
      return unwrap(result);
    },
    onMutate: ({ todoId }) => ({ before: findCachedTodo(queryClient, { todoId }) }),
    onSuccess: (saved, { changedField, scope }, { before }) => {
      // 이후 회차까지 옮기면 바뀐 날짜를 몰라 넓게 맞춘다
      if (scope == null) {
        settleTodoEdit(queryClient, { before, after: saved });
      } else {
        invalidateTodos(queryClient);
      }
      toast.success(
        changedField === 'time' ? t('todo:toast.timeChanged') : t('todo:toast.dateChanged'),
      );
      if (scope != null) {
        trackEvent('todo_series_edited', { scope });
      }
    },
    onError: (error) => {
      const seriesFailure = findTodoSeriesFailure(error);
      if (seriesFailure != null) {
        haptics.notify('error');
        if (shouldRefreshTodos(seriesFailure)) {
          invalidateTodos(queryClient);
        }
        toast.error(
          t(`todo:toast.series.${seriesFailure}.title`, {
            limit: getTodoSeriesLimit(error),
          }),
          { description: t(`todo:toast.series.${seriesFailure}.description`) },
        );
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.updateFailedRetry',
        isHandledByFeature: isTodoSeriesFailure,
      },
    },
  });
}

import { useHaptics, useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { invalidateWeeklyAchievements } from '@src/features/insights/achievement/queries/achievement-cache';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import {
  changeCachedCategoryTodoCount,
  getCachedTodoCategories,
  invalidateTodoCategories,
} from '@src/features/planning/category/queries/todo-category-cache';
import { useTrack } from '@src/shared/analytics';
import { getIsoWeekYear, type DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui';
import { createOptimisticId } from '@src/shared/utils/create-optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TodoOverviewPolicy } from '../domains/todo-overview.model';
import type { TodoUpdateScope, TodoEditScope } from '../domains/todo-repeat.model';
import { createTodoDateSpan, TodoSchedulePolicy } from '../domains/todo-schedule.model';
import { isTodoSeriesFailure } from '../domains/todo-series.error';
import { isCategoryTodoLimitError } from '../domains/todo.error';
import type { TodoFieldChanges } from '../domains/todo.model';
import type { TodoFormValues } from '../schemas/todo-form.schema';
import type {
  TodoCategoryMove,
  TodoCompletionChange,
  TodoReorder,
  TodoScheduleChange,
} from '../schemas/todo-request.schema';
import type { TodoSeriesEditOptions } from '../schemas/todo-series-request.schema';
import { toTodoEditedFields } from '../utils/todo-analytics';
import {
  appendTodoToList,
  beginTodoWrite,
  findCachedTodo,
  getCachedTodoDateSpan,
  getTodoOverviewFilters,
  getTodoDetailsFilter,
  invalidateTodoDependentQueries,
  type OptimisticTodo,
  removeTodoFromList,
  removeTodoPage,
  restoreTodo,
  saveCreatedTodo,
  settleTodoEdit,
  settleTodoReorder,
  settleTodoSeriesWrite,
  settleTodoWrite,
  snapshotTodo,
  syncDailyCompletionWithList,
  updateCachedTodo,
  setTodoOverviewInCache,
} from './todo-cache';
import { TODO_MUTATION_KEYS } from './todo-mutation-keys';
import { TODO_QUERY_KEYS } from './todo-query-keys';
import { useTodoSeriesFailureFeedback } from './todo-series.mutations';

export interface ToggleTodoVariables {
  todoId: number;
  body: TodoCompletionChange;
  /** 체크한 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useToggleTodoMutationOptions() {
  const todoApi = useTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const todayKey = useTodayKey();

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
      // 앞 체크의 응답은 뒤 체크를 덮지 않게 마지막만, 값이 같으면 쓰지 않는다(쓰면 제목 저장이 남긴 낡음 표시가 지워진다)
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
      setTodoOverviewInCache(queryClient, (overview) =>
        TodoOverviewPolicy.withTodoCompleted(overview),
      );
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
        extra: [
          getTodoDetailsFilter({ todoId }),
          // 완료를 풀면 완료한 할 일이 하나도 남지 않았는지 서버만 안다
          ...(body.completed ? [] : getTodoOverviewFilters()),
        ],
      });
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.changeFailedRetry' } },
  });
}

interface ChangeTodoCategoryVariables {
  todoId: number;
  input: TodoCategoryMove;
  scope?: TodoUpdateScope;
}

export function useChangeTodoCategoryMutationOptions() {
  const todoApi = useTodoApi();
  const queryClient = useQueryClient();
  const showTodoSeriesFailure = useTodoSeriesFailureFeedback();
  const toast = useAppToast();
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
    onSuccess: (_saved, variables) => {
      toast.success(t('todo:toast.categoryChanged'));
      trackEvent('todo_edited', { todo_id: variables.todoId, field: 'categoryId' });
      if (variables.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.scope });
      }
    },
    onError: (error) => {
      showTodoSeriesFailure(error);
    },
    onSettled: (saved, _error, { scope }, context) => {
      if (saved == null) {
        return;
      }
      // 이후 회차까지 바꾸면 바뀐 날짜를 몰라 넓게 맞춘다
      if (scope == null) {
        settleTodoEdit(queryClient, { before: context?.before ?? null, after: saved });
      } else {
        settleTodoSeriesWrite(queryClient);
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
  const showTodoSeriesFailure = useTodoSeriesFailureFeedback();
  const toast = useAppToast();

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
      removeTodoPage(queryClient, { todoId });
      toast.success(t('todo:toast.todoDeleted'));
      trackEvent('todo_deleted', { todo_id: todoId });
      if (scope != null) {
        trackEvent('todo_series_deleted', { scope });
        return;
      }
      const categoryId = context.snapshot?.todo.category.id;
      if (categoryId != null) {
        changeCachedCategoryTodoCount(queryClient, { categoryId, delta: -1 });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot != null) {
        restoreTodo(queryClient, context.snapshot);
        syncDailyCompletionWithList(queryClient, { date: context.snapshot.date });
      }

      showTodoSeriesFailure(error);
    },
    onSettled: (_data, error, { todoId, date, scope }, context) => {
      invalidateTodoDependentQueries(queryClient);
      if (error == null && scope != null) {
        settleTodoSeriesWrite(queryClient);
      } else if (error == null && context?.snapshot == null) {
        invalidateTodoCategories(queryClient);
      }
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
          // 지우지 못했으면 상세도 서버 값으로 맞춘다. 지웠으면 성공 때 버렸다
          ...(error == null ? [] : [{ queryKey: TODO_QUERY_KEYS.page({ todoId }) }]),
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
  todoId: number;
  input: TodoReorder;
}

export function useReorderTodoMutationOptions() {
  const todoApi = useTodoApi();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();

  return mutationOptions({
    // 저장하는 동안 목록이 끌기 전 순서를 붙잡는다. 오프라인에 멈춰 두면 연결될 때까지 묶이니 바로 실패해 제자리로 돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, input }: ReorderTodoVariables) => {
      const result = await todoApi.reorderTodo(todoId, input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('todo_reordered', { source: 'feed' });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_reorder' });
      }
    },
    onSettled: (_data, _error, { todoId }) => {
      settleTodoReorder(queryClient, { todoId });
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.changeFailedRetry' } },
  });
}

export interface UpdateTodoScheduleVariables {
  todoId: number;
  input: TodoScheduleChange;
  /** 사용자가 고친 칸. 저장 안내 문구를 고른다. 안내를 따로 띄우는 곳(날씨 일괄 옮기기)은 넘기지 않는다 */
  changedField?: 'date' | 'time';
  scope?: TodoUpdateScope;
}

export function useUpdateTodoScheduleMutationOptions() {
  const todoApi = useTodoApi();
  const queryClient = useQueryClient();
  const showTodoSeriesFailure = useTodoSeriesFailureFeedback();
  const toast = useAppToast();
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
    onSuccess: (_saved, { changedField, scope }) => {
      toast.success(
        changedField === 'time' ? t('todo:toast.timeChanged') : t('todo:toast.dateChanged'),
      );
      if (scope != null) {
        trackEvent('todo_series_edited', { scope });
      }
    },
    onError: (error) => {
      showTodoSeriesFailure(error);
    },
    onSettled: (saved, _error, { scope }, context) => {
      if (saved == null) {
        return;
      }
      // 이후 회차까지 옮기면 바뀐 날짜를 몰라 넓게 맞춘다
      if (scope == null) {
        settleTodoEdit(queryClient, { before: context?.before ?? null, after: saved });
      } else {
        settleTodoSeriesWrite(queryClient);
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

interface CreateTodoVariables {
  values: TodoFormValues;
}

export function useCreateTodoMutationOptions() {
  const haptics = useHaptics();
  const todoApi = useTodoApi();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ values }: CreateTodoVariables) => {
      const result = await todoApi.createTodo(values);
      return unwrap(result);
    },
    onMutate: async ({ values }) => {
      const startDate = values.startDate;
      const span = TodoSchedulePolicy.getDateSpan(values);
      const ticket = await beginTodoWrite(queryClient, {
        date: startDate,
        isCompletionAffected: true,
      });

      const category = TodoCategoryPolicy.findCategory(
        getCachedTodoCategories(queryClient)?.categories,
        values.categoryId,
      );

      // 카테고리를 찾지 못하면 낙관적 삽입을 건너뛰고 서버 응답 뒤 invalidate로 맞춘다
      if (category == null) {
        return { startDate, span, ticket, optimisticId: undefined };
      }

      const optimisticTodo: OptimisticTodo = {
        id: createOptimisticId(),
        title: values.title,
        startDate: values.startDate,
        endDate: values.endDate,
        category: { id: category.id, name: category.name, color: category.color },
        completed: false,
        localTime: TodoSchedulePolicy.findScheduledTime(values),
        scheduledAt: null,
        isAllDay: values.isAllDay,
        visibility: values.visibility,
        recurrenceGroupId: null,
        repeat: null,
        subTodos: [],
        commentCount: 0,
        optimistic: true,
      };

      appendTodoToList(queryClient, { date: startDate }, optimisticTodo);
      syncDailyCompletionWithList(queryClient, { date: startDate });

      return { startDate, span, ticket, optimisticId: optimisticTodo.id };
    },
    onSuccess: (saved, { values }, { startDate, optimisticId }) => {
      // 응답이 만든 할 일 전체라 목록·존재 여부·카테고리 개수를 응답으로 고치고 다시 받지 않는다
      if (optimisticId != null) {
        saveCreatedTodo(queryClient, { date: startDate, optimisticId }, saved);
        changeCachedCategoryTodoCount(queryClient, { categoryId: saved.category.id, delta: 1 });
      }
      setTodoOverviewInCache(queryClient, (overview) =>
        TodoOverviewPolicy.withTodoCreated(overview),
      );
      emitTodoCreated();
      toast.success(t('todo:toast.todoAdded'));
      trackEvent('todo_created', {
        source: 'manual',
        creation_entry: 'manual',
        is_recurring: false,
        has_scheduled_time: TodoSchedulePolicy.findScheduledTime(values) != null,
        is_all_day: values.isAllDay,
        visibility: values.visibility,
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.optimisticId != null) {
        removeTodoFromList(queryClient, { date: context.startDate, todoId: context.optimisticId });
        syncDailyCompletionWithList(queryClient, { date: context.startDate });
      }

      if (isCategoryTodoLimitError(error)) {
        haptics.notify('error');
        toast.error(t('todo:toast.categoryLimitReached'));
      }
    },
    onSettled: (_saved, error, { values }, context) => {
      // 카테고리를 몰라 낙관적으로 넣지 못했으면 개수도 서버에 묻는다
      if (error == null && context?.optimisticId == null) {
        invalidateTodoCategories(queryClient);
      }
      settleTodoWrite(queryClient, {
        date: values.startDate,
        span: context?.span ?? createTodoDateSpan(values.startDate, null),
        isCompletionAffected: true,
        hasFailed: error != null || context?.optimisticId == null,
        ticket: context?.ticket,
      });
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.addFailedRetry',
        isHandledByFeature: isCategoryTodoLimitError,
      },
    },
  });
}

interface UpdateTodoVariables {
  todoId: number;
  fields: TodoFieldChanges;
  options?: TodoSeriesEditOptions;
}

export function useUpdateTodoMutationOptions() {
  const todoApi = useTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showTodoSeriesFailure = useTodoSeriesFailureFeedback();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    // 저장을 기다리는 시트라 낙관적으로 쓰지 않는다. 다른 체크의 낙관적 값을 재조회로 덮지 않게 같은 키로 센다
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, fields, options }: UpdateTodoVariables) => {
      const result = await todoApi.updateTodo(todoId, fields, options);
      return unwrap(result);
    },
    onMutate: ({ todoId }) => ({ before: findCachedTodo(queryClient, { todoId }) }),
    onSuccess: (_saved, variables) => {
      toast.success(t('todo:toast.todoUpdated'));
      trackEvent('todo_edited', {
        todo_id: variables.todoId,
        field: toTodoEditedFields(variables.fields, variables.options),
      });
      if (variables.options?.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.options.scope });
      }
      // oxlint-disable-next-line aido/no-strict-nullish -- repeat null만 반복 끝내기다
      if (variables.options?.repeat === null) {
        trackEvent('todo_series_stopped');
      }
    },
    onError: (error) => {
      showTodoSeriesFailure(error);
    },
    onSettled: (saved, _error, { options }, context) => {
      if (saved == null) {
        return;
      }
      // 반복 범위·규칙을 바꾸면 바뀐 회차의 날짜를 몰라 넓게 맞춘다.
      // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기다
      if (options?.scope == null && options?.repeat === undefined) {
        settleTodoEdit(queryClient, { before: context?.before ?? null, after: saved });
      } else {
        settleTodoSeriesWrite(queryClient);
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

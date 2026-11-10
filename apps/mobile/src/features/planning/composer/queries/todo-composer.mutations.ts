import {
  useActivationService,
  useHaptics,
  useTodoService,
  useSubTodoService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getCachedActivationContext } from '@src/features/device/activation/queries/activation-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import {
  changeCachedCategoryTodoCount,
  invalidateTodoCategories,
} from '@src/features/planning/category/queries/todo-category-cache';
import { TODO_MUTATION_KEYS } from '@src/features/planning/todo/constants/todo-mutation-keys';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import {
  findTodoSeriesFailure,
  getTodoSeriesLimit,
  shouldRefreshTodos,
} from '@src/features/planning/todo/domains/todo-series.error';
import {
  isCategoryTodoLimitError,
  isRecurringCategoryTodoLimitError,
} from '@src/features/planning/todo/domains/todo.error';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { OptimisticTodo } from '@src/features/planning/todo/domains/todo.model';
import {
  appendTodoToList,
  beginTodoWrite,
  findCachedTodo,
  getCachedTodoDateSpan,
  getTodoDateSpan,
  getTodoExistenceFilters,
  invalidateTodos,
  removeTodoFromList,
  saveCreatedTodo,
  settleTodoEdit,
  settleTodoWrite,
  syncDailyCompletionWithList,
  updateCachedTodo,
  updateCachedTodoExistence,
  withTodoCreated,
} from '@src/features/planning/todo/queries/todo-cache';
import type {
  CreateTodoInput,
  UpdateTodoInput,
} from '@src/features/planning/todo/schemas/todo-request.schema';
import type {
  RepeatingTodoDraft,
  TodoSeriesEditOptions,
} from '@src/features/planning/todo/schemas/todo-series-request.schema';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { createOptimisticId } from '@src/shared/utils/create-optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

interface CreateTodoVariables {
  input: CreateTodoInput;
}

export function useCreateTodoMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ input }: CreateTodoVariables) => {
      const result = await todoService.createTodo(input);
      return unwrap(result);
    },
    onMutate: async ({ input }) => {
      const startDate = input.startDate;
      const span = getTodoDateSpan({ startDate, endDate: input.endDate ?? null });
      const ticket = await beginTodoWrite(queryClient, {
        date: startDate,
        isCompletionAffected: true,
      });

      const category = TodoCategoryPolicy.findCategory(
        queryClient.getQueryData(TODO_CATEGORY_QUERY_KEYS.list())?.categories ?? [],
        input.categoryId,
      );

      // 카테고리를 찾지 못하면 낙관적 삽입을 건너뛰고 서버 응답 뒤 invalidate로 맞춘다
      if (!category) {
        return { startDate, span, ticket, optimisticId: undefined };
      }

      const optimisticTodo: OptimisticTodo = {
        id: createOptimisticId(),
        title: input.title,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        category: { id: category.id, name: category.name, color: category.color },
        completed: false,
        localTime: input.scheduledTime ?? null,
        scheduledAt: null,
        isAllDay: input.isAllDay,
        visibility: TodoPolicy.getVisibility(input),
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
    onSuccess: (saved, { input }, { startDate, optimisticId }) => {
      // 응답이 만든 할 일 전체라 목록·존재 여부·카테고리 개수를 응답으로 고치고 다시 받지 않는다
      if (optimisticId == null) {
        invalidateTodoCategories(queryClient);
      } else {
        saveCreatedTodo(queryClient, { date: startDate, optimisticId }, saved);
        changeCachedCategoryTodoCount(queryClient, { categoryId: saved.category.id, delta: 1 });
      }
      updateCachedTodoExistence(queryClient, withTodoCreated);
      activationService.recordTodoCreated({
        ...getCachedActivationContext(queryClient),
        now: getNowInstant(),
      });
      toast.success(t('todo:toast.todoAdded'));
      trackEvent('todo_created', {
        source: 'manual',
        creation_entry: 'manual',
        is_recurring: false,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: TodoPolicy.getVisibility(input),
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
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
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.addFailedRetry'),
      });
    },
    onSettled: (_saved, error, { input }, context) => {
      settleTodoWrite(queryClient, {
        date: input.startDate,
        span: context?.span ?? getTodoDateSpan({ startDate: input.startDate, endDate: null }),
        isCompletionAffected: true,
        hasFailed: error != null || context?.optimisticId == null,
        ticket: context?.ticket,
      });
    },
  });
}

interface AddSubTodoVariables {
  todoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useAddSubTodoMutationOptions() {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, title }: AddSubTodoVariables) => {
      const result = await subTodoService.addSubTodo(todoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, title, date }) => {
      // 끝낸 일에 더할 때만 완료가 풀려 달력·위젯·시작 체크리스트가 바뀐다. 취소는 진행 중 조회를 되돌려 먼저 읽어도 같다
      const wasCompleted = findCachedTodo(queryClient, { date, todoId })?.completed ?? false;
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: wasCompleted,
      });
      const optimisticId = createOptimisticId();
      const span = getCachedTodoDateSpan(queryClient, { date, todoId });
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoAdded(todo, {
          id: optimisticId,
          title,
          completed: false,
          sortOrder: todo.subTodos.length,
        }),
      );
      if (wasCompleted) {
        syncDailyCompletionWithList(queryClient, { date });
      }

      return { optimisticId, wasCompleted, ticket, span };
    },
    onSuccess: (saved, { todoId, date }, { optimisticId }) => {
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoConfirmed(todo, optimisticId, saved),
      );
      trackEvent('todo_item_added', { todo_id: todoId });
    },
    onError: (error, { todoId, date }, context) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.subTodoAddFailed'),
      });

      if (context != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
          ...SubTodoPolicy.withSubTodoRemoved(todo, context.optimisticId),
          completed: context.wasCompleted,
        }));
        if (context.wasCompleted) {
          syncDailyCompletionWithList(queryClient, { date });
        }
      }
    },
    onSettled: (_saved, error, { todoId, date }, context) => {
      const wasCompleted = context?.wasCompleted ?? true;
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        isCompletionAffected: wasCompleted,
        hasFailed: error != null,
        ticket: context?.ticket,
        extra: wasCompleted ? getTodoExistenceFilters() : [],
      });
    },
  });
}

interface CreateRecurringTodoVariables {
  input: RepeatingTodoDraft;
}

export function useCreateRecurringTodoMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationFn: async ({ input }: CreateRecurringTodoVariables) => {
      const result = await todoService.createRepeatingTodo(input);
      return unwrap(result);
    },
    onSuccess: (_, { input }) => {
      activationService.recordTodoCreated({
        ...getCachedActivationContext(queryClient),
        now: getNowInstant(),
      });
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.recurringAdded'));
      trackEvent('todo_created', {
        source: 'manual',
        creation_entry: 'recurring',
        is_recurring: true,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: input.visibility,
        repeat_frequency: input.repeat.frequency,
        repeat_end: input.repeat.end.type,
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
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
        return;
      }

      if (isRecurringCategoryTodoLimitError(error)) {
        haptics.notify('error');
        toast.error(t('todo:toast.recurringCategoryLimit'));
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.addFailedRetry'),
      });
    },
  });
}

interface UpdateSubTodoVariables {
  todoId: number;
  subTodoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useUpdateSubTodoMutationOptions() {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, title }: UpdateSubTodoVariables) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, title, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: false,
      });
      const previous = findCachedTodo(queryClient, { date, todoId })?.subTodos.find(
        (subTodo) => subTodo.id === subTodoId,
      );
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRenamed(todo, subTodoId, title),
      );

      return {
        previousTitle: previous?.title,
        ticket,
        span: getCachedTodoDateSpan(queryClient, { date, todoId }),
      };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_updated', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (error, { todoId, subTodoId, date }, context) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.subTodoUpdateFailed'),
      });
      const previousTitle = context?.previousTitle;
      if (previousTitle != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodoRenamed(todo, subTodoId, previousTitle),
        );
      }
    },
    onSettled: (_data, error, { todoId, date }, context) => {
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        isCompletionAffected: false,
        hasFailed: error != null,
        ticket: context?.ticket,
      });
    },
  });
}

interface UpdateTodoVariables {
  todoId: number;
  input: UpdateTodoInput;
  options?: TodoSeriesEditOptions;
}

export function useUpdateTodoMutationOptions() {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    // 저장을 기다리는 시트라 낙관적으로 쓰지 않는다. 다른 체크의 낙관적 값을 재조회로 덮지 않게 같은 키로 센다
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, input, options }: UpdateTodoVariables) => {
      const result = await todoService.updateTodo(todoId, input, options);
      return unwrap(result);
    },
    onMutate: ({ todoId }) => ({ before: findCachedTodo(queryClient, { todoId }) }),
    onSuccess: (saved, variables, { before }) => {
      // 반복 범위·규칙을 바꾸면 바뀐 회차의 날짜를 몰라 넓게 맞춘다. nullish-strict: repeat null은 반복 끝내기다
      if (variables.options?.scope == null && variables.options?.repeat === undefined) {
        settleTodoEdit(queryClient, { before, after: saved });
      } else {
        invalidateTodos(queryClient);
      }
      toast.success(t('todo:toast.todoUpdated'));
      const field = Object.keys(variables.input).join(',');
      trackEvent('todo_edited', { todo_id: variables.todoId, field });
      if (variables.options?.scope != null) {
        trackEvent('todo_series_edited', { scope: variables.options.scope });
      }
      // nullish-strict: repeat null만 반복 끝내기다
      if (variables.options?.repeat === null) {
        trackEvent('todo_series_stopped');
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
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.updateFailedRetry'),
      });
    },
  });
}

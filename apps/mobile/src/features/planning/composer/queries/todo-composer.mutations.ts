import { ErrorCode } from '@aido/api/errors';
import {
  useActivationService,
  useHaptics,
  useTodoService,
  useSubTodoService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { recordTodoCreatedForActivation } from '@src/features/device/activation/queries/activation-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import type { TodoCategoriesResult } from '@src/features/planning/category/schemas/todo-category.schema';
import { TODO_MUTATION_KEYS } from '@src/features/planning/todo/constants/todo-mutation-keys';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import {
  appendTodoToList,
  cancelTodoCompletionQueries,
  confirmTodoInList,
  removeTodoFromList,
  settleTodoCompletionWrite,
  syncDailyCompletionWithList,
  snapshotTodo,
  updateCachedTodo,
  invalidateTodos,
  cancelTodoQueries,
  settleTodoListWrite,
} from '@src/features/planning/todo/queries/todo-cache';
import { useTodoSeriesFailureHandler } from '@src/features/planning/todo/queries/todo-series.mutations';
import type {
  RepeatingTodoDraft,
  TodoSeriesEditOptions,
} from '@src/features/planning/todo/schemas/todo-repeat.schema';
import type {
  CreateTodoInput,
  UpdateTodoInput,
} from '@src/features/planning/todo/schemas/todo-request.schema';
import type { OptimisticTodo } from '@src/features/planning/todo/schemas/todo.schema';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { createOptimisticId } from '@src/shared/utils/optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export interface CreateTodoParams {
  input: CreateTodoInput;
  source: 'manual';
}

export function useCreateTodoMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.addFailedRetry'));

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ input }: CreateTodoParams) => {
      const result = await todoService.createTodo(input);
      return unwrap(result);
    },
    onMutate: async ({ input }) => {
      const startDate = input.startDate;

      await cancelTodoCompletionQueries(queryClient, { date: startDate });

      const categoriesData = queryClient.getQueryData<TodoCategoriesResult>(
        TODO_CATEGORY_QUERY_KEYS.list(),
      );
      const category = categoriesData?.categories.find(
        (candidate) => candidate.id === input.categoryId,
      );

      // 카테고리를 찾지 못하면 낙관적 삽입을 건너뛰고 서버 응답 뒤 invalidate로 맞춘다
      if (!category) {
        return { startDate, optimisticId: undefined };
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
        visibility: input.visibility ?? 'PUBLIC',
        recurrenceGroupId: null,
        repeat: null,
        subTodos: [],
        subTodoStats: { total: 0, completed: 0 },
        commentCount: 0,
        optimistic: true,
      };

      appendTodoToList(queryClient, { date: startDate }, optimisticTodo);
      syncDailyCompletionWithList(queryClient, { date: startDate });

      return { startDate, optimisticId: optimisticTodo.id };
    },
    onSuccess: (saved, { input, source }, { startDate, optimisticId }) => {
      if (optimisticId != null) {
        confirmTodoInList(queryClient, { date: startDate, optimisticId }, saved);
      }
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success(t('todo:toast.todoAdded'));
      trackEvent('todo_created', {
        source,
        creation_entry: 'manual',
        is_recurring: false,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
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

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0811)) {
        haptics.notify('error');
        toast.error(t('todo:toast.categoryLimitReached'));
        return;
      }

      showFailure(error);
    },
    onSettled: () => {
      settleTodoCompletionWrite(queryClient);
    },
  });
}

interface AddSubTodoParams {
  todoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useAddSubTodoMutationOptions() {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showFailure = useMutationFailure(t('todo:toast.subTodoAddFailed'));

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, title }: AddSubTodoParams) => {
      const result = await subTodoService.addSubTodo(todoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, title, date }) => {
      await cancelTodoCompletionQueries(queryClient, { date, todoId });
      const optimisticId = createOptimisticId();
      const wasCompleted = snapshotTodo(queryClient, { date, todoId })?.todo.completed ?? false;
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoAdded(todo, {
          id: optimisticId,
          title,
          completed: false,
          sortOrder: todo.subTodos.length,
        }),
      );
      syncDailyCompletionWithList(queryClient, { date });

      return { optimisticId, wasCompleted };
    },
    onSuccess: (saved, { todoId, date }, { optimisticId }) => {
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoConfirmed(todo, optimisticId, saved),
      );
      trackEvent('todo_item_added', { todo_id: todoId });
    },
    onError: (error, { todoId, date }, context) => {
      showFailure(error);

      if (context != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
          ...SubTodoPolicy.withSubTodoRemoved(todo, context.optimisticId),
          completed: context.wasCompleted,
        }));
        syncDailyCompletionWithList(queryClient, { date });
      }
    },
    onSettled: () => {
      settleTodoCompletionWrite(queryClient);
    },
  });
}

export interface CreateRecurringTodoParams {
  input: RepeatingTodoDraft;
  source: 'manual';
}

export function useCreateRecurringTodoMutationOptions() {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.addFailedRetry'));
  const handleSeriesFailure = useTodoSeriesFailureHandler();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationFn: async ({ input }: CreateRecurringTodoParams) => {
      const result = await todoService.createRepeatingTodo(input);
      return unwrap(result);
    },
    onSuccess: (_, { input, source }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.recurringAdded'));
      trackEvent('todo_created', {
        source,
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
      if (handleSeriesFailure(error)) {
        return;
      }

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0813)) {
        haptics.notify('error');
        toast.error(t('todo:toast.recurringCategoryLimit'));
        return;
      }

      showFailure(error);
    },
  });
}

interface UpdateSubTodoParams {
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
  const showFailure = useMutationFailure(t('todo:toast.subTodoUpdateFailed'));

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, title }: UpdateSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, { title });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, title, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      const previous = snapshotTodo(queryClient, { date, todoId })?.todo.subTodos.find(
        (subTodo) => subTodo.id === subTodoId,
      );
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRenamed(todo, subTodoId, title),
      );

      return { previousTitle: previous?.title };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_updated', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (error, { todoId, subTodoId, date }, context) => {
      showFailure(error);
      const previousTitle = context?.previousTitle;
      if (previousTitle != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodoRenamed(todo, subTodoId, previousTitle),
        );
      }
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
}

interface UpdateTodoMutationParams {
  todoId: number;
  input: UpdateTodoInput;
  options?: TodoSeriesEditOptions;
}

export function useUpdateTodoMutationOptions() {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.updateFailedRetry'));
  const handleSeriesFailure = useTodoSeriesFailureHandler();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationFn: async ({ todoId, input, options }: UpdateTodoMutationParams) => {
      const result = await todoService.updateTodo(todoId, input, options);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      invalidateTodos(queryClient);
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
      if (handleSeriesFailure(error)) {
        return;
      }

      showFailure(error);
    },
  });
}

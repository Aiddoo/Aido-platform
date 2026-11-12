import { useHaptics, useTodoApi, useSubTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import {
  changeCachedCategoryTodoCount,
  getCachedTodoCategories,
  invalidateTodoCategories,
} from '@src/features/planning/category/queries/todo-category-cache';
import type { TodoEditedFields } from '@src/features/planning/todo/constants/todo.events';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';
import { isTodoSeriesFailure } from '@src/features/planning/todo/domains/todo-series.error';
import {
  isCategoryTodoLimitError,
  isRecurringCategoryTodoLimitError,
  isRecurringTodoRejection,
} from '@src/features/planning/todo/domains/todo.error';
import { getScheduledTime } from '@src/features/planning/todo/domains/todo.model';
import type { OptimisticTodo } from '@src/features/planning/todo/domains/todo.model';
import { useTodoSeriesFailureFeedback } from '@src/features/planning/todo/hooks/use-todo-series-failure-feedback';
import {
  appendTodoToList,
  beginTodoWrite,
  findCachedTodo,
  getCachedTodoDateSpan,
  getTodoDateSpan,
  getTodoOverviewFilters,
  invalidateTodos,
  removeTodoFromList,
  saveCreatedTodo,
  settleTodoEdit,
  settleTodoWrite,
  syncDailyCompletionWithList,
  updateCachedTodo,
  updateCachedTodoOverview,
  withTodoCreated,
} from '@src/features/planning/todo/queries/todo-cache';
import { TODO_MUTATION_KEYS } from '@src/features/planning/todo/queries/todo-mutation-keys';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { UpdateTodoInput } from '@src/features/planning/todo/schemas/todo-request.schema';
import type { TodoSeriesEditOptions } from '@src/features/planning/todo/schemas/todo-series-request.schema';
import { useTrack } from '@src/shared/analytics';
import type { DateKey } from '@src/shared/date/date-key';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { createOptimisticId } from '@src/shared/utils/create-optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

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
      const span = getTodoDateSpan(values);
      const ticket = await beginTodoWrite(queryClient, {
        date: startDate,
        isCompletionAffected: true,
      });

      const category = TodoCategoryPolicy.findCategory(
        getCachedTodoCategories(queryClient)?.categories ?? [],
        values.categoryId,
      );

      // 카테고리를 찾지 못하면 낙관적 삽입을 건너뛰고 서버 응답 뒤 invalidate로 맞춘다
      if (!category) {
        return { startDate, span, ticket, optimisticId: undefined };
      }

      const optimisticTodo: OptimisticTodo = {
        id: createOptimisticId(),
        title: values.title,
        startDate: values.startDate,
        endDate: values.endDate,
        category: { id: category.id, name: category.name, color: category.color },
        completed: false,
        localTime: getScheduledTime(values),
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
      updateCachedTodoOverview(queryClient, withTodoCreated);
      emitTodoCreated();
      toast.success(t('todo:toast.todoAdded'));
      trackEvent('todo_created', {
        source: 'manual',
        creation_entry: 'manual',
        is_recurring: false,
        has_scheduled_time: getScheduledTime(values) != null,
        is_all_day: values.isAllDay,
        visibility: values.visibility,
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
      }
    },
    onSettled: (_saved, error, { values }, context) => {
      // 카테고리를 몰라 낙관적으로 넣지 못했으면 개수도 서버에 묻는다
      if (error == null && context?.optimisticId == null) {
        invalidateTodoCategories(queryClient);
      }
      settleTodoWrite(queryClient, {
        date: values.startDate,
        span: context?.span ?? getTodoDateSpan({ startDate: values.startDate, endDate: null }),
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

interface AddSubTodoVariables {
  todoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useAddSubTodoMutationOptions() {
  const subTodoApi = useSubTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ todoId, title }: AddSubTodoVariables) => {
      const result = await subTodoApi.addSubTodo(todoId, { title });
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
    onError: (_error, { todoId, date }, context) => {
      if (context == null) {
        return;
      }
      // 함께 진행 중인 쓰기가 있으면 그 쓰기가 남긴 완료 값을 지킨다. 뒤에 더한 항목이 남으면 완료가 아니다
      const shouldRestoreCompletion =
        context.wasCompleted && isLastMutation(queryClient, TODO_MUTATION_KEYS.listWrites());
      updateCachedTodo(queryClient, { date, todoId }, (todo) => ({
        ...SubTodoPolicy.withSubTodoRemoved(todo, context.optimisticId),
        completed: shouldRestoreCompletion || todo.completed,
      }));
      if (shouldRestoreCompletion) {
        syncDailyCompletionWithList(queryClient, { date });
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
        extra: wasCompleted ? getTodoOverviewFilters() : [],
      });
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.subTodoAddFailed' } },
  });
}

interface CreateRecurringTodoVariables {
  values: TodoFormValues & { repeat: TodoRepeat };
}

export function useCreateRecurringTodoMutationOptions() {
  const haptics = useHaptics();
  const todoApi = useTodoApi();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const showTodoSeriesFailure = useTodoSeriesFailureFeedback();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationFn: async ({ values }: CreateRecurringTodoVariables) => {
      const result = await todoApi.createRepeatingTodo(values);
      return unwrap(result);
    },
    onSuccess: (_, { values }) => {
      emitTodoCreated();
      toast.success(t('todo:toast.recurringAdded'));
      trackEvent('todo_created', {
        source: 'manual',
        creation_entry: 'recurring',
        is_recurring: true,
        has_scheduled_time: getScheduledTime(values) != null,
        is_all_day: values.isAllDay,
        visibility: values.visibility,
        repeat_frequency: values.repeat.frequency,
        repeat_end: values.repeat.end.type,
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
      }
    },
    onError: (error) => {
      if (showTodoSeriesFailure(error)) {
        return;
      }

      if (isRecurringCategoryTodoLimitError(error)) {
        haptics.notify('error');
        toast.error(t('todo:toast.recurringCategoryLimit'));
      }
    },
    // 반복 회차가 어느 날짜에 생겼는지 몰라 넓게 맞춘다
    onSettled: (_saved, error) => {
      if (error == null) {
        invalidateTodos(queryClient);
      }
    },
    meta: {
      errorFeedback: {
        feature: 'todo',
        fallbackKey: 'todo:toast.addFailedRetry',
        isHandledByFeature: isRecurringTodoRejection,
      },
    },
  });
}

interface UpdateSubTodoVariables {
  todoId: number;
  subTodoId: number;
  title: string;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useUpdateSubTodoMutationOptions() {
  const subTodoApi = useSubTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 저장 시트가 스피너만 돈다. 바로 실패해 입력값을 지킨다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, title }: UpdateSubTodoVariables) => {
      const result = await subTodoApi.updateSubTodo(todoId, subTodoId, { title });
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
    onError: (_error, { todoId, subTodoId, date }, context) => {
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
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.subTodoUpdateFailed' } },
  });
}

// 수정 폼이 칸을 담는 순서다. 분석의 field 값이 이 순서로 이어진다
const TODO_EDITED_FIELD_ORDER = [
  'title',
  'categoryId',
  'startDate',
  'endDate',
  'scheduledTime',
  'isAllDay',
  'visibility',
] as const satisfies readonly (keyof UpdateTodoInput)[];

// 칸을 고치지 않고 반복만 바꾼 수정(단일 → 반복 포함)은 repeat 한 칸으로 남긴다
function toEditedFields(
  input: UpdateTodoInput,
  options: TodoSeriesEditOptions = {},
): TodoEditedFields | null {
  const [first, ...rest] = TODO_EDITED_FIELD_ORDER.filter((field) => field in input);
  if (first == null) {
    // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 바꾼 것이다
    return options.repeat === undefined ? null : 'repeat';
  }
  return rest.length === 0 ? first : `${first},${rest.join(',')}`;
}

interface UpdateTodoVariables {
  todoId: number;
  input: UpdateTodoInput;
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
    mutationFn: async ({ todoId, input, options }: UpdateTodoVariables) => {
      const result = await todoApi.updateTodo(todoId, input, options);
      return unwrap(result);
    },
    onMutate: ({ todoId }) => ({ before: findCachedTodo(queryClient, { todoId }) }),
    onSuccess: (_saved, variables) => {
      toast.success(t('todo:toast.todoUpdated'));
      trackEvent('todo_edited', {
        todo_id: variables.todoId,
        field: toEditedFields(variables.input, variables.options) ?? undefined,
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
        invalidateTodos(queryClient);
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

import { useHaptics, useTodoApi } from '@src/bootstrap/providers/di-context';
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
import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';
import { isTodoSeriesFailure } from '@src/features/planning/todo/domains/todo-series.error';
import {
  isCategoryTodoLimitError,
  isRecurringCategoryTodoLimitError,
  isRecurringTodoRejection,
} from '@src/features/planning/todo/domains/todo.error';
import { getScheduledTime } from '@src/features/planning/todo/domains/todo.model';
import type {
  OptimisticTodo,
  TodoFieldChanges,
} from '@src/features/planning/todo/domains/todo.model';
import { useTodoSeriesFailureFeedback } from '@src/features/planning/todo/hooks/use-todo-series-failure-feedback';
import {
  appendTodoToList,
  beginTodoWrite,
  findCachedTodo,
  getTodoDateSpan,
  removeTodoFromList,
  saveCreatedTodo,
  settleTodoEdit,
  settleTodoSeriesWrite,
  settleTodoWrite,
  syncDailyCompletionWithList,
  updateCachedTodoOverview,
  withTodoCreated,
} from '@src/features/planning/todo/queries/todo-cache';
import { TODO_MUTATION_KEYS } from '@src/features/planning/todo/queries/todo-mutation-keys';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { TodoSeriesEditOptions } from '@src/features/planning/todo/schemas/todo-series-request.schema';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
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
    // 회차를 낙관적으로 넣지 않지만, 넓게 다시 받을 때 진행 중인 체크의 낙관적 값을 덮지 않게 같은 키로 센다
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
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
      if (accountId != null) {
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
        settleTodoSeriesWrite(queryClient);
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

// 수정 폼이 칸을 담는 순서다. 분석의 field 값이 이 순서로 이어진다
const TODO_EDITED_FIELD_ORDER = [
  'title',
  'categoryId',
  'startDate',
  'endDate',
  'scheduledTime',
  'isAllDay',
  'visibility',
] as const satisfies readonly (keyof TodoFieldChanges)[];

// 칸을 고치지 않고 반복만 바꾼 수정(단일 → 반복 포함)은 repeat 한 칸으로 남긴다
function toEditedFields(
  fields: TodoFieldChanges,
  options: TodoSeriesEditOptions = {},
): TodoEditedFields | undefined {
  const [first, ...rest] = TODO_EDITED_FIELD_ORDER.filter((field) => field in fields);
  if (first == null) {
    // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 바꾼 것이다
    return options.repeat === undefined ? undefined : 'repeat';
  }
  return rest.length === 0 ? first : `${first},${rest.join(',')}`;
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
        field: toEditedFields(variables.fields, variables.options),
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

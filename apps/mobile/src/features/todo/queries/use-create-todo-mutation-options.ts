import type { CreateTodoInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useActivationService, useTodoService } from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { toDate } from '@src/shared/utils/date';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { TodoCategoriesResult } from '../domains/todo-category.model';
import type { OptimisticTodo, TodoListResult } from '../domains/todo.model';
import { createOptimisticId } from './todo-cache';

export interface CreateTodoParams {
  input: CreateTodoInput;
  source: 'manual' | 'ai';
}

function parseScheduledTime(time: string, dateStr: string): Date {
  const parts = time.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const date = toDate(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export const useCreateTodoMutationOptions = () => {
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ input }: CreateTodoParams) => {
      const result = await todoService.createTodo(input);
      return unwrap(result);
    },
    onMutate: async ({ input }) => {
      const startDate = input.startDate;

      await queryClient.cancelQueries({
        queryKey: TODO_QUERY_KEYS.listByDate({ date: startDate }),
      });

      // 카테고리 캐시에서 카테고리 정보 조회
      const categoriesData = queryClient.getQueryData<TodoCategoriesResult>(
        TODO_CATEGORY_QUERY_KEYS.list(),
      );
      const category = categoriesData?.categories.find((c) => c.id === input.categoryId);

      // 카테고리를 찾지 못하면 optimistic 삽입 건너뜀 (서버 응답 후 invalidate로 처리)
      if (!category) {
        return { startDate, optimisticId: undefined };
      }

      const optimisticTodo: OptimisticTodo = {
        id: createOptimisticId(),
        title: input.title,
        startDate: input.startDate,
        endDate: null,
        category: { id: category.id, name: category.name, color: category.color },
        completed: false,
        scheduledAtMs: input.scheduledTime
          ? parseScheduledTime(input.scheduledTime, input.startDate).getTime()
          : null,
        isAllDay: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
        recurrenceGroupId: null,
        subTodos: [],
        subTodoStats: { total: 0, completed: 0 },
        commentCount: 0,
        optimistic: true,
      };

      queryClient.setQueryData<TodoListResult>(
        TODO_QUERY_KEYS.listByDate({ date: startDate }),
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            todos: [...old.todos, optimisticTodo],
          };
        },
      );

      return { startDate, optimisticId: optimisticTodo.id };
    },
    onSuccess: (_data, { input, source }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      queryClient.invalidateQueries({
        queryKey: TODO_QUERY_KEYS.listByDate({ date: input.startDate }),
      });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success(t('todo:toast.todoAdded'));
      trackEvent('todo_created', {
        source,
        creation_entry: source === 'ai' ? 'ai_parse' : 'manual',
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.optimisticId != null) {
        queryClient.setQueryData<TodoListResult>(
          TODO_QUERY_KEYS.listByDate({ date: context.startDate }),
          (current) =>
            current && {
              ...current,
              todos: current.todos.filter((todo) => todo.id !== context.optimisticId),
            },
        );
      }

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0811)) {
        toast.error(t('todo:toast.categoryLimitReached'));
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.addFailedRetry') });
    },
  });
};

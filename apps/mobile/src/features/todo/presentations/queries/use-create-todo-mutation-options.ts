import { ErrorCode } from '@aido/errors';
import type { CreateTodoInput } from '@aido/validators';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isTodoError } from '../../models/todo.error';
import type { OptimisticTodoItem, TodosResult } from '../../models/todo.model';
import type { TodoCategoriesResult } from '../../models/todo-category.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export interface CreateTodoParams {
  input: CreateTodoInput;
  source: 'manual' | 'ai';
}

function parseScheduledTime(time: string, dateStr: string): Date {
  const parts = time.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export const useCreateTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ input }: CreateTodoParams) => {
      const result = await todoService.createTodo(input);
      return unwrap(result);
    },
    onMutate: async ({ input }) => {
      const startDate = input.startDate;

      await queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate(startDate) });

      const previousData = queryClient.getQueryData<TodosResult>(
        TODO_QUERY_KEYS.listByDate(startDate),
      );

      // 카테고리 캐시에서 카테고리 정보 조회
      const categoriesData = queryClient.getQueryData<TodoCategoriesResult>(
        TODO_CATEGORY_QUERY_KEYS.list(),
      );
      const category = categoriesData?.categories.find((c) => c.id === input.categoryId);

      // 카테고리를 찾지 못하면 optimistic 삽입 건너뜀 (서버 응답 후 invalidate로 처리)
      if (!category) {
        return { previousData, startDate };
      }

      const optimisticTodo: OptimisticTodoItem = {
        id: Math.random(),
        title: input.title,
        startDate: input.startDate,
        endDate: null,
        category: { id: category.id, name: category.name, color: category.color },
        completed: false,
        scheduledTime: input.scheduledTime
          ? parseScheduledTime(input.scheduledTime, input.startDate)
          : null,
        isAllDay: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
        recurrenceGroupId: null,
        subTodos: [],
        subTodoStats: { total: 0, completed: 0 },
        optimistic: true,
      };

      queryClient.setQueryData<TodosResult>(TODO_QUERY_KEYS.listByDate(startDate), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          todos: [...old.todos, optimisticTodo],
        };
      });

      return { previousData, startDate };
    },
    onSuccess: (_data, { input, source }) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.listByDate(input.startDate) });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.ranges() });
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      toast.success(t('todo:toast.todoAdded'));
      trackEvent('todo_created', {
        source,
        is_recurring: false,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
      });
    },
    onError: (error, _variables, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          TODO_QUERY_KEYS.listByDate(context.startDate),
          context.previousData,
        );
      }

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0811)) {
        toast.error(t('todo:toast.categoryLimitReached'));
        return;
      }

      if (isTodoError(error) || isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.addFailedRetry') });
    },
  });
};

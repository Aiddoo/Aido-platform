import type { CreateTodoInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import {
  useActivationService,
  useHaptics,
  useTodoService,
} from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import type { TodoCategoriesResult } from '../domains/todo-category.model';
import type { OptimisticTodo } from '../domains/todo.model';
import {
  appendTodoToList,
  cancelTodoCompletionQueries,
  confirmTodoInList,
  createOptimisticId,
  removeTodoFromList,
  settleTodoCompletionWrite,
  syncDailyCompletionWithList,
} from './todo-cache';

export interface CreateTodoParams {
  input: CreateTodoInput;
  source: 'manual' | 'ai';
}

export const useCreateTodoMutationOptions = () => {
  const haptics = useHaptics();
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    mutationFn: async ({ input }: CreateTodoParams) => {
      const result = await todoService.createTodo(input);
      return unwrap(result);
    },
    onMutate: async ({ input }) => {
      const startDate = input.startDate;

      await cancelTodoCompletionQueries(queryClient, { date: startDate });

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
        endDate: input.endDate ?? null,
        category: { id: category.id, name: category.name, color: category.color },
        completed: false,
        localTime: input.scheduledTime ?? null,
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
      haptics.notify('error');

      if (context?.optimisticId != null) {
        removeTodoFromList(queryClient, { date: context.startDate, todoId: context.optimisticId });
        syncDailyCompletionWithList(queryClient, { date: context.startDate });
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
    onSettled: () => {
      settleTodoCompletionWrite(queryClient);
    },
  });
};

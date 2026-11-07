import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  cancelTodoQueries,
  settleTodoListWrite,
  updateCachedTodo,
  snapshotTodo,
} from './todo-cache';

interface ToggleSubTodoParams {
  todoId: number;
  subTodoId: number;
  isCompleted: boolean;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useToggleSubTodoMutationOptions() {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, isCompleted }: ToggleSubTodoParams) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, {
        completed: isCompleted,
      });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, isCompleted, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoToggled(todo, subTodoId, isCompleted),
      );
    },
    onSuccess: (_data, { todoId, subTodoId, isCompleted }) => {
      trackEvent('todo_item_completed', {
        todo_id: todoId,
        item_id: subTodoId,
        is_completed: isCompleted,
      });
    },
    onError: (_error, { todoId, subTodoId, isCompleted, date }) => {
      haptics.notify('error');
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoToggled(todo, subTodoId, !isCompleted),
      );
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
}

interface DeleteSubTodoParams {
  todoId: number;
  subTodoId: number;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useDeleteSubTodoMutationOptions() {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showFailure = useMutationFailure(t('todo:toast.subTodoDeleteFailed'));

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId }: DeleteSubTodoParams) => {
      const result = await subTodoService.deleteSubTodo(todoId, subTodoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      const subTodos = snapshotTodo(queryClient, { date, todoId })?.todo.subTodos ?? [];
      const index = subTodos.findIndex((subTodo) => subTodo.id === subTodoId);
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRemoved(todo, subTodoId),
      );

      return { removed: subTodos[index], index };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_deleted', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (error, { todoId, date }, context) => {
      showFailure(error);
      if (context?.removed != null) {
        const { removed, index } = context;
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodoRestored(todo, removed, index),
        );
      }
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
}

interface ReorderSubTodosParams {
  todoId: number;
  subTodoIds: number[];
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useReorderSubTodosMutationOptions() {
  const haptics = useHaptics();
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoIds }: ReorderSubTodosParams) => {
      const result = await subTodoService.reorderSubTodos(todoId, { itemIds: subTodoIds });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoIds, date }) => {
      await cancelTodoQueries(queryClient, { date, todoId });
      const previousIds = snapshotTodo(queryClient, { date, todoId })?.todo.subTodos.map(
        (subTodo) => subTodo.id,
      );
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodosOrdered(todo, subTodoIds),
      );

      return { previousIds };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (_err, { todoId, date }, context) => {
      haptics.notify('error');
      const previousIds = context?.previousIds;
      if (previousIds != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodosOrdered(todo, previousIds),
        );
      }
    },
    onSettled: () => {
      settleTodoListWrite(queryClient);
    },
  });
}

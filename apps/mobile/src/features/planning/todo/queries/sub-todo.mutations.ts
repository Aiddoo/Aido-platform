import { useHaptics, useSubTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  beginTodoWrite,
  getSnapshotDateSpan,
  settleTodoWrite,
  snapshotTodo,
  updateCachedTodo,
} from './todo-cache';

interface ToggleSubTodoVariables {
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
  const toast = useAppToast();

  return mutationOptions({
    // 응답까지 이 체크박스가 꺼진다. 오프라인에 멈춰 두면 연결될 때까지 꺼진 채 남으니 바로 실패해 되돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, isCompleted }: ToggleSubTodoVariables) => {
      const result = await subTodoService.updateSubTodo(todoId, subTodoId, {
        completed: isCompleted,
      });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, isCompleted, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        affectsCompletion: false,
      });
      const span = getSnapshotDateSpan(snapshotTodo(queryClient, { date, todoId }), date);
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoCompleted(todo, subTodoId, isCompleted),
      );

      return { ticket, span };
    },
    onSuccess: (_data, { todoId, subTodoId, isCompleted }) => {
      trackEvent('todo_item_completed', {
        todo_id: todoId,
        item_id: subTodoId,
        is_completed: isCompleted,
      });
    },
    onError: (error, { todoId, subTodoId, isCompleted, date }) => {
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoCompleted(todo, subTodoId, !isCompleted),
      );
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todo:toast.subTodoUpdateFailed') });
    },
    onSettled: (_data, error, { todoId, date }, context) => {
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        affectsCompletion: false,
        failed: error != null,
        ticket: context?.ticket,
      });
    },
  });
}

interface DeleteSubTodoVariables {
  todoId: number;
  subTodoId: number;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: string;
}

export function useDeleteSubTodoMutationOptions() {
  const subTodoService = useSubTodoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 삭제 중 표시가 끝나지 않는다. 바로 실패해 안내하고 낙관 삭제를 되돌린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId }: DeleteSubTodoVariables) => {
      const result = await subTodoService.deleteSubTodo(todoId, subTodoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        affectsCompletion: false,
      });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      const subTodos = snapshot?.todo.subTodos ?? [];
      const index = subTodos.findIndex((subTodo) => subTodo.id === subTodoId);
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRemoved(todo, subTodoId),
      );

      return {
        removed: subTodos[index],
        index,
        ticket,
        span: getSnapshotDateSpan(snapshot, date),
      };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_deleted', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (error, { todoId, date }, context) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('todo:toast.subTodoDeleteFailed'),
      });
      if (context?.removed != null) {
        const { removed, index } = context;
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodoRestored(todo, removed, index),
        );
      }
    },
    onSettled: (_data, error, { todoId, date }, context) => {
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        affectsCompletion: false,
        failed: error != null,
        ticket: context?.ticket,
      });
    },
  });
}

interface ReorderSubTodosVariables {
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
  const toast = useAppToast();

  return mutationOptions({
    // 저장하는 동안 목록이 끌기 전 순서를 붙잡는다. 오프라인에 멈춰 두면 연결될 때까지 묶이니 바로 실패해 제자리로 돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoIds }: ReorderSubTodosVariables) => {
      const result = await subTodoService.reorderSubTodos(todoId, { itemIds: subTodoIds });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoIds, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        affectsCompletion: false,
      });
      const snapshot = snapshotTodo(queryClient, { date, todoId });
      const previousIds = snapshot?.todo.subTodos.map((subTodo) => subTodo.id);
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodosOrdered(todo, subTodoIds),
      );

      return { previousIds, ticket, span: getSnapshotDateSpan(snapshot, date) };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (error, { todoId, date }, context) => {
      const previousIds = context?.previousIds;
      if (previousIds != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodosOrdered(todo, previousIds),
        );
      }
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('todo:toast.changeFailedRetry') });
    },
    onSettled: (_data, error, { todoId, date }, context) => {
      settleTodoWrite(queryClient, {
        date,
        todoId,
        span: context?.span ?? { startDate: date, endDate: date },
        affectsCompletion: false,
        failed: error != null,
        ticket: context?.ticket,
      });
    },
  });
}

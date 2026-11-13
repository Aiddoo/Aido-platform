import { useSubTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import type { DateKey } from '@src/shared/date/date-key';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { createOptimisticId } from '@src/shared/utils/create-optimistic-id';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { SubTodoPolicy } from '../domains/sub-todo.model';
import {
  beginTodoWrite,
  findCachedTodo,
  getCachedTodoDateSpan,
  getTodoOverviewFilters,
  settleTodoWrite,
  syncDailyCompletionWithList,
  updateCachedTodo,
} from './todo-cache';
import { TODO_MUTATION_KEYS } from './todo-mutation-keys';

interface ToggleSubTodoVariables {
  todoId: number;
  subTodoId: number;
  isCompleted: boolean;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useToggleSubTodoMutationOptions() {
  const subTodoApi = useSubTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 응답까지 이 체크박스가 꺼진다. 오프라인에 멈춰 두면 연결될 때까지 꺼진 채 남으니 바로 실패해 되돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId, isCompleted }: ToggleSubTodoVariables) => {
      const result = await subTodoApi.updateSubTodo(todoId, subTodoId, {
        completed: isCompleted,
      });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, isCompleted, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: false,
      });
      const span = getCachedTodoDateSpan(queryClient, { date, todoId });
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
    onError: (_error, { todoId, subTodoId, isCompleted, date }) => {
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoCompleted(todo, subTodoId, !isCompleted),
      );
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

interface DeleteSubTodoVariables {
  todoId: number;
  subTodoId: number;
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useDeleteSubTodoMutationOptions() {
  const subTodoApi = useSubTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈춰 두면 삭제 중 표시가 끝나지 않는다. 바로 실패해 안내하고 낙관 삭제를 되돌린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoId }: DeleteSubTodoVariables) => {
      const result = await subTodoApi.deleteSubTodo(todoId, subTodoId);
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoId, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: false,
      });
      const subTodos = findCachedTodo(queryClient, { date, todoId })?.subTodos ?? [];
      const index = subTodos.findIndex((subTodo) => subTodo.id === subTodoId);
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodoRemoved(todo, subTodoId),
      );

      return {
        removed: subTodos[index],
        index,
        ticket,
        span: getCachedTodoDateSpan(queryClient, { date, todoId }),
      };
    },
    onSuccess: (_data, { todoId, subTodoId }) => {
      trackEvent('todo_item_deleted', { todo_id: todoId, item_id: subTodoId });
    },
    onError: (_error, { todoId, date }, context) => {
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
        isCompletionAffected: false,
        hasFailed: error != null,
        ticket: context?.ticket,
      });
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.subTodoDeleteFailed' } },
  });
}

interface ReorderSubTodosVariables {
  todoId: number;
  subTodoIds: number[];
  /** 바꾼 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜 목록을 고친다 */
  date: DateKey;
}

export function useReorderSubTodosMutationOptions() {
  const subTodoApi = useSubTodoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 저장하는 동안 목록이 끌기 전 순서를 붙잡는다. 오프라인에 멈춰 두면 연결될 때까지 묶이니 바로 실패해 제자리로 돌리고 알린다
    networkMode: 'always',
    mutationKey: TODO_MUTATION_KEYS.listWrites(),
    mutationFn: async ({ todoId, subTodoIds }: ReorderSubTodosVariables) => {
      const result = await subTodoApi.reorderSubTodos(todoId, { itemIds: subTodoIds });
      return unwrap(result);
    },
    onMutate: async ({ todoId, subTodoIds, date }) => {
      const ticket = await beginTodoWrite(queryClient, {
        date,
        todoId,
        isCompletionAffected: false,
      });
      const previousIds = findCachedTodo(queryClient, { date, todoId })?.subTodos.map(
        (subTodo) => subTodo.id,
      );
      updateCachedTodo(queryClient, { date, todoId }, (todo) =>
        SubTodoPolicy.withSubTodosOrdered(todo, subTodoIds),
      );

      return {
        previousIds,
        ticket,
        span: getCachedTodoDateSpan(queryClient, { date, todoId }),
      };
    },
    onSuccess: (_data, { todoId }) => {
      trackEvent('todo_item_reordered', { todo_id: todoId });
    },
    onError: (_error, { todoId, date }, context) => {
      const previousIds = context?.previousIds;
      if (previousIds != null) {
        updateCachedTodo(queryClient, { date, todoId }, (todo) =>
          SubTodoPolicy.withSubTodosOrdered(todo, previousIds),
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
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.changeFailedRetry' } },
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

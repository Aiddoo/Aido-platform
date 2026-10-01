import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/services/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

/** 상세 화면이 읽는 할 일 본문·권한·집계. 댓글 목록은 todo-comment feature가 따로 가져온다. */
export function getTodoDetailsQueryOptions(
  todoService: TodoService,
  { todoId }: { todoId: number },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.details(todoId),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoDetails(todoId, signal)),
  });
}

export function useTodoDetailsQueryOptions(todoId: number) {
  return getTodoDetailsQueryOptions(useTodoService(), { todoId });
}

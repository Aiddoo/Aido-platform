import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

/** 상세 화면이 읽는 할 일 본문·권한·집계. 댓글 목록은 todo-comment feature가 따로 가져온다. */
export function useTodoDetailsQueryOptions(todoId: number) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.details(todoId),
    queryFn: async () => unwrap(await todoService.getTodoDetails(todoId)),
  });
}

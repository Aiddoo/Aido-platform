import { isApiError } from '@src/shared/errors';
import { useQuery } from '@tanstack/react-query';

import { useGetTodoDetailsQueryOptions } from '../queries/todo.queries';
import { useTodoParams } from './use-todo-params';

const NOT_FOUND_STATUS = 404;

/** 서버는 지운 할 일과 볼 권한이 없는 할 일을 모두 404로 답한다. 화면은 본문·댓글 대신 안내 하나만 보인다 */
export function useIsTodoUnavailable() {
  const { todoId } = useTodoParams();
  const { error } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return isApiError(error) && error.status === NOT_FOUND_STATUS;
}

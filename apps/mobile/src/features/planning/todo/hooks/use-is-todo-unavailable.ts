import { useQuery } from '@tanstack/react-query';

import { isTodoUnavailableError } from '../domains/todo.error';
import { useGetTodoDetailsQueryOptions } from '../queries/todo.queries';
import { useTodoId } from './use-todo-params';

/** 지운 할 일과 볼 권한이 없는 할 일은 같은 오류다. 화면은 본문·댓글 대신 안내 하나만 보인다 */
export function useIsTodoUnavailable() {
  const [todoId] = useTodoId();
  const { error } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return isTodoUnavailableError(error);
}

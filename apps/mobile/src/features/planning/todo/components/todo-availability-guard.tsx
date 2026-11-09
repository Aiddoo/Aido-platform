import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren, ReactNode } from 'react';

import { isTodoUnavailableError } from '../domains/todo.error';
import { useTodoId } from '../hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '../queries/todo.queries';

interface TodoAvailabilityGuardProps extends PropsWithChildren {
  /** 지운 할 일과 볼 권한이 없는 할 일에 본문·댓글 대신 보이는 안내 */
  fallback: ReactNode;
}

/** 지운 할 일과 볼 권한이 없는 할 일은 같은 오류다. 화면은 본문·댓글 대신 안내 하나만 보인다 */
export function TodoAvailabilityGuard({ fallback, children }: TodoAvailabilityGuardProps) {
  const [todoId] = useTodoId();
  const { error } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  if (isTodoUnavailableError(error)) {
    return fallback;
  }

  return children;
}

import type { PropsWithChildren, ReactNode } from 'react';

import { useIsTodoUnavailable } from '../hooks/use-is-todo-unavailable';

interface TodoAvailabilityGuardProps extends PropsWithChildren {
  /** 지운 할 일과 볼 권한이 없는 할 일에 본문·댓글 대신 보이는 안내 */
  fallback: ReactNode;
}

export function TodoAvailabilityGuard({ fallback, children }: TodoAvailabilityGuardProps) {
  const isTodoUnavailable = useIsTodoUnavailable();

  if (isTodoUnavailable) {
    return fallback;
  }

  return children;
}

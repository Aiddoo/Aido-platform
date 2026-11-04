import { createContext, type PropsWithChildren, use, useCallback, useMemo, useState } from 'react';

import { type ThreadExpansion, TodoCommentPolicy } from '../domains/todo-comment.model';

interface TodoCommentExpansionValue {
  expansionByThread: ReadonlyMap<string, ThreadExpansion>;
  updateExpansion: (
    threadCommentId: string,
    update: (current: ThreadExpansion | undefined) => ThreadExpansion,
  ) => void;
}

const TodoCommentExpansionContext = createContext<TodoCommentExpansionValue | null>(null);

/**
 * 펼친 묶음. 묶음 행과 작성 바(게시하면 그 묶음을 펼친다)가 같이 쓰므로 화면이 소유한다.
 * 알림으로 연 묶음처럼 처음부터 펼칠 묶음은 사용처가 기본값으로 정하고, 사용자가 바꾸면 그 값을 따른다.
 */
export function TodoCommentExpansionProvider({ children }: PropsWithChildren) {
  const [expansionByThread, setExpansionByThread] = useState<ReadonlyMap<string, ThreadExpansion>>(
    () => new Map(),
  );

  const updateExpansion = useCallback<TodoCommentExpansionValue['updateExpansion']>(
    (threadCommentId, update) => {
      setExpansionByThread((previous) =>
        new Map(previous).set(threadCommentId, update(previous.get(threadCommentId))),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({ expansionByThread, updateExpansion }),
    [expansionByThread, updateExpansion],
  );

  return <TodoCommentExpansionContext value={value}>{children}</TodoCommentExpansionContext>;
}

function useTodoCommentExpansion() {
  const value = use(TodoCommentExpansionContext);
  if (value == null) {
    throw new Error('useTodoCommentExpansion must be used inside TodoCommentExpansionProvider');
  }
  return value;
}

export function useThreadExpansion(threadCommentId: string, defaultExpansion: ThreadExpansion) {
  const { expansionByThread, updateExpansion } = useTodoCommentExpansion();
  const expansion = expansionByThread.get(threadCommentId) ?? defaultExpansion;
  const setExpansion = useCallback(
    (next: ThreadExpansion) => updateExpansion(threadCommentId, () => next),
    [updateExpansion, threadCommentId],
  );

  return [expansion, setExpansion] as const;
}

/** 답글을 올리면 그 묶음을 펼친다. 사용자가 직접 펼친 묶음은 그 상태를 지킨다 */
export function useExpandThread() {
  const { updateExpansion } = useTodoCommentExpansion();
  return useCallback(
    (threadCommentId: string) =>
      updateExpansion(threadCommentId, (current) =>
        TodoCommentPolicy.expandThread(current, 'auto'),
      ),
    [updateExpansion],
  );
}

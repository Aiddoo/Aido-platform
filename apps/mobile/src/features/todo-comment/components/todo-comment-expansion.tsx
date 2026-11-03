import { createContext, type PropsWithChildren, use, useCallback, useMemo, useState } from 'react';

interface TodoCommentExpansionValue {
  expandedByThread: ReadonlyMap<string, boolean>;
  setExpanded: (threadCommentId: string, isExpanded: boolean) => void;
}

const TodoCommentExpansionContext = createContext<TodoCommentExpansionValue | null>(null);

/**
 * 펼친 묶음. 묶음 행과 작성 바(게시하면 그 묶음을 펼친다)가 같이 쓰므로 화면이 소유한다.
 * 알림으로 연 묶음처럼 처음부터 펼칠 묶음은 사용처가 기본값으로 정하고, 사용자가 바꾸면 그 값을 따른다.
 */
export function TodoCommentExpansionProvider({ children }: PropsWithChildren) {
  const [expandedByThread, setExpandedByThread] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );

  const setExpanded = useCallback((threadCommentId: string, isExpanded: boolean) => {
    setExpandedByThread((previous) => new Map(previous).set(threadCommentId, isExpanded));
  }, []);

  const value = useMemo(() => ({ expandedByThread, setExpanded }), [expandedByThread, setExpanded]);

  return <TodoCommentExpansionContext value={value}>{children}</TodoCommentExpansionContext>;
}

function useTodoCommentExpansion() {
  const value = use(TodoCommentExpansionContext);
  if (value == null) {
    throw new Error('useTodoCommentExpansion must be used inside TodoCommentExpansionProvider');
  }
  return value;
}

export function useThreadExpansion(threadCommentId: string, isExpandedByDefault: boolean) {
  const { expandedByThread, setExpanded } = useTodoCommentExpansion();
  const isExpanded = expandedByThread.get(threadCommentId) ?? isExpandedByDefault;
  const setIsExpanded = useCallback(
    (next: boolean) => setExpanded(threadCommentId, next),
    [setExpanded, threadCommentId],
  );

  return [isExpanded, setIsExpanded] as const;
}

export function useExpandThread() {
  const { setExpanded } = useTodoCommentExpansion();
  return useCallback(
    (threadCommentId: string) => setExpanded(threadCommentId, true),
    [setExpanded],
  );
}

import { createEventChannel } from '@src/core/events/event-channel';
import { createContext, type PropsWithChildren, use, useState, useSyncExternalStore } from 'react';

import { expandThread, type ThreadExpansion } from '../utils/todo-comment-replies.view-model';

// 펼침을 Context 값으로 내리면 묶음 하나를 펼칠 때 모든 답글 목록과 작성기가 다시 그려진다. 묶음마다 자기 값만 구독한다
function createThreadExpansionStore() {
  const expansionByThread = new Map<string, ThreadExpansion>();
  const changed = createEventChannel('todo-comment-thread-expansion');

  return {
    find: (threadCommentId: string) => expansionByThread.get(threadCommentId) ?? null,
    update: (
      threadCommentId: string,
      update: (current: ThreadExpansion | null) => ThreadExpansion,
    ) => {
      const current = expansionByThread.get(threadCommentId) ?? null;
      const next = update(current);
      if (next === current) {
        return;
      }
      expansionByThread.set(threadCommentId, next);
      changed.emit();
    },
    subscribe: (listener: () => void) => changed.subscribe(listener),
  };
}

const TodoCommentExpansionContext = createContext<ReturnType<
  typeof createThreadExpansionStore
> | null>(null);

/**
 * 펼친 묶음. 묶음 행과 작성 바(게시하면 그 묶음을 펼친다)가 같이 쓰므로 화면이 소유한다.
 * 알림으로 연 묶음처럼 처음부터 펼칠 묶음은 사용처가 기본값으로 정하고, 사용자가 바꾸면 그 값을 따른다.
 */
export function TodoCommentExpansionProvider({ children }: PropsWithChildren) {
  const [store] = useState(createThreadExpansionStore);

  return <TodoCommentExpansionContext value={store}>{children}</TodoCommentExpansionContext>;
}

function useThreadExpansionStore() {
  const store = use(TodoCommentExpansionContext);
  if (store == null) {
    throw new Error('useThreadExpansion must be used inside TodoCommentExpansionProvider');
  }

  return store;
}

/** 이 묶음의 펼침이 바뀔 때만 다시 그린다 */
export function useThreadExpansion(threadCommentId: string, defaultExpansion: ThreadExpansion) {
  const store = useThreadExpansionStore();
  const expansion =
    useSyncExternalStore(store.subscribe, () => store.find(threadCommentId)) ?? defaultExpansion;
  const setExpansion = (next: ThreadExpansion) => store.update(threadCommentId, () => next);

  return [expansion, setExpansion] as const;
}

/** 저장소에 쓰기만 해서 어느 묶음이 펼쳐져도 부른 곳은 다시 그려지지 않는다 */
export function useExpandThread() {
  const store = useThreadExpansionStore();

  return (threadCommentId: string) =>
    store.update(threadCommentId, (current) => expandThread(current, 'auto'));
}

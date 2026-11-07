import { useIsTodoUnavailable } from '@src/features/planning/todo/hooks/use-is-todo-unavailable';
import { useTodoParams } from '@src/features/planning/todo/hooks/use-todo-params';
import { QueryErrorBoundary } from '@src/shared/ui';
import { Suspense } from 'react';

import { useCommentParams } from '../hooks/use-comment-params';
import { TodoCommentComposerBar } from './todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardArea } from './todo-comment-keyboard-area';
import { TodoCommentThreadList } from './todo-comment-thread-list';
import { TodoDetailHeader } from './todo-detail-header';
import { TodoDetailSummary } from './todo-detail-summary';

interface TodoCommentPaneProps {
  onClose: () => void;
}

/** 할 일 상세와 댓글 목록, 작성 바. 할 일이 사라졌으면 안내 카드로 바꾼다 */
export function TodoCommentPane({ onClose }: TodoCommentPaneProps) {
  const { todoId } = useTodoParams();
  const [{ sort, comment }] = useCommentParams();
  const isTodoUnavailable = useIsTodoUnavailable();

  if (isTodoUnavailable) {
    return <TodoDetailSummary.Unavailable onClose={onClose} />;
  }

  return (
    <TodoCommentKeyboardArea>
      <QueryErrorBoundary
        resetKeys={[todoId, sort, comment]}
        fallback={(props) => (
          <TodoCommentThreadList.Error {...props} header={<TodoDetailHeader />} />
        )}
      >
        <Suspense fallback={<TodoCommentThreadList.Loading header={<TodoDetailHeader />} />}>
          <TodoCommentThreadList header={<TodoDetailHeader />} />
        </Suspense>
      </QueryErrorBoundary>

      <QueryErrorBoundary resetKeys={[todoId]}>
        <TodoCommentComposerBar />
      </QueryErrorBoundary>
    </TodoCommentKeyboardArea>
  );
}

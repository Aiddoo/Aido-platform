import { TodoAvailabilityGuard } from '@src/features/planning/todo/components/todo-availability-guard';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { QueryErrorBoundary } from '@src/shared/ui';
import { type ReactNode, Suspense } from 'react';

import { useTodoCommentParams } from '../hooks/use-todo-comment-params';
import { TodoCommentComposerBar } from './todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardGesture } from './todo-comment-keyboard-gesture';
import { TodoCommentSession } from './todo-comment-session';
import { TodoCommentThreadList } from './todo-comment-thread-list';
import { TodoDetailSummary } from './todo-detail-summary';

interface TodoCommentPaneProps {
  /** 제목 줄. 상세 화면은 네이티브 헤더, 펼친 피드의 오른쪽 칸은 직접 그린 제목 줄이다 */
  titleBar: ReactNode;
  /** 지웠거나 볼 수 없는 할 일의 안내에서 닫을 때 */
  onClose: () => void;
  /** 댓글 세션에서 뒤로 갈 때. 없으면 화면의 뒤로 가기를 따른다 */
  onExit?: () => void;
}

/** 할 일 상세 칸 하나. 상세 화면과 펼친 피드의 오른쪽 칸이 같은 조립을 쓴다 */
export function TodoCommentPane({ titleBar, onClose, onExit }: TodoCommentPaneProps) {
  const [todoId] = useTodoId();
  const [{ sort, comment }] = useTodoCommentParams();

  return (
    <TodoCommentSession onExit={onExit}>
      {titleBar}

      <TodoAvailabilityGuard fallback={<TodoDetailSummary.Unavailable onClose={onClose} />}>
        <TodoCommentKeyboardGesture>
          <QueryErrorBoundary
            resetKeys={[todoId, sort, comment]}
            fallback={TodoCommentThreadList.Error}
          >
            <Suspense fallback={<TodoCommentThreadList.Loading />}>
              <TodoCommentThreadList />
            </Suspense>
          </QueryErrorBoundary>

          <QueryErrorBoundary resetKeys={[todoId]}>
            <Suspense fallback={<TodoCommentComposerBar.Loading />}>
              <TodoCommentComposerBar />
            </Suspense>
          </QueryErrorBoundary>
        </TodoCommentKeyboardGesture>
      </TodoAvailabilityGuard>
    </TodoCommentSession>
  );
}

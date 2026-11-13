import { TodoAvailabilityGuard } from '@src/features/planning/todo/components/todo-availability-guard';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { Box, QueryErrorBoundary } from '@src/shared/ui';
import { type PropsWithChildren, type ReactNode, Suspense } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardGestureArea } from 'react-native-keyboard-controller';

import { TODO_COMMENT_INPUT_NATIVE_ID } from '../constants/todo-comment.constants';
import { useTodoCommentParams } from '../hooks/use-todo-comment-params';
import { TodoCommentComposerBar } from './todo-comment-composer-bar';
import { TodoCommentSession } from './todo-comment-session';
import { TodoCommentThreadList } from './todo-comment-thread-list';
import { TodoDetailSummary } from './todo-detail-summary';

const styles = StyleSheet.create({ gestureArea: { flex: 1 } });

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
          {/* 본문·댓글·작성 바를 기다리는 경계는 하나다. 여럿이 함께 기다리면 React 19가 서로의 재시도를 번갈아 그려 응답 전까지 렌더가 끝나지 않는다 */}
          <QueryErrorBoundary resetKeys={[todoId]}>
            <Suspense fallback={<TodoCommentPane.Loading />}>
              {/* 목록 머리가 본문(상세)을 함께 그린다. 상세 오류는 이 경계의 fallback 머리가 다시 던져 칸 경계가 받고, 다시 시도 범위는 칸과 함께 쓴다 */}
              <QueryErrorBoundary
                resetKeys={[todoId, sort, comment]}
                resetScope="parent"
                fallback={TodoCommentThreadList.Error}
              >
                <TodoCommentThreadList />
              </QueryErrorBoundary>

              <TodoCommentComposerBar />
            </Suspense>
          </QueryErrorBoundary>
        </TodoCommentKeyboardGesture>
      </TodoAvailabilityGuard>
    </TodoCommentSession>
  );
}

TodoCommentPane.Loading = function Loading() {
  return (
    <>
      <TodoCommentThreadList.Loading />
      <TodoCommentComposerBar.Loading />
    </>
  );
};

/** 목록과 작성 바를 함께 감싸 Android에서 키보드를 손가락으로 끌어 내리게 한다 */
function TodoCommentKeyboardGesture({ children }: PropsWithChildren) {
  return (
    <KeyboardGestureArea
      style={styles.gestureArea}
      textInputNativeID={TODO_COMMENT_INPUT_NATIVE_ID}
    >
      <Box flex={1} testID="todo-comment-threads">
        {children}
      </Box>
    </KeyboardGestureArea>
  );
}

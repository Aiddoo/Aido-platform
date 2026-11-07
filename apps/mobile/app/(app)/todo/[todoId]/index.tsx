import { TodoCommentComposerBar } from '@src/features/engagement/comment/components/todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardArea } from '@src/features/engagement/comment/components/todo-comment-keyboard-area';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentThreadList } from '@src/features/engagement/comment/components/todo-comment-thread-list';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailCard } from '@src/features/engagement/comment/components/todo-detail-card';
import { TodoDetailHeader } from '@src/features/engagement/comment/components/todo-detail-header';
import { useCommentParams } from '@src/features/engagement/comment/hooks/use-comment-params';
import { useIsTodoUnavailable } from '@src/features/planning/todo/hooks/use-is-todo-unavailable';
import { useTodoParams } from '@src/features/planning/todo/hooks/use-todo-params';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

/** 할 일 상세와 댓글·답글 한 화면. 알림·링크는 `?comment=`로 그 댓글 위치를 연다 */
export default function TodoDetailRoute() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return <TodoDetailScreen />;
}

function TodoDetailScreen() {
  const { todoId } = useTodoParams();
  const [{ sort, comment }] = useCommentParams();
  const isTodoUnavailable = useIsTodoUnavailable();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']} testID="todo-detail">
      <TodoCommentSession>
        <TodoCommentTitleBar.StackHeader />

        {isTodoUnavailable ? (
          <TodoDetailCard.Unavailable onClose={router.back} />
        ) : (
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
        )}
      </TodoCommentSession>
    </StyledSafeAreaView>
  );
}

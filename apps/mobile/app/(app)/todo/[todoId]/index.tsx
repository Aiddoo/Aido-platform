import { TodoCommentComposerBar } from '@src/features/engagement/comment/components/todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardArea } from '@src/features/engagement/comment/components/todo-comment-keyboard-area';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentThreadList } from '@src/features/engagement/comment/components/todo-comment-thread-list';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailSummary } from '@src/features/engagement/comment/components/todo-detail-summary';
import { useCommentParams } from '@src/features/engagement/comment/hooks/use-comment-params';
import { TodoAvailabilityGuard } from '@src/features/planning/todo/components/todo-availability-guard';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

/** 할 일 상세와 댓글·답글 한 화면. 알림·링크는 `?comment=`로 그 댓글 위치를 연다 */
export default function TodoDetailScreen() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());
  const [{ sort, comment }] = useCommentParams();
  const goBack = useSingleTap(router.back);

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  const { todoId } = params.data;

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']} testID="todo-detail">
      <TodoCommentSession>
        <TodoCommentTitleBar.StackHeader />

        <TodoAvailabilityGuard fallback={<TodoDetailSummary.Unavailable onClose={goBack} />}>
          <TodoCommentKeyboardArea>
            <QueryErrorBoundary
              resetKeys={[todoId, sort, comment]}
              fallback={TodoCommentThreadList.Error}
            >
              <Suspense fallback={<TodoCommentThreadList.Loading />}>
                <TodoCommentThreadList />
              </Suspense>
            </QueryErrorBoundary>

            <QueryErrorBoundary resetKeys={[todoId]}>
              <TodoCommentComposerBar />
            </QueryErrorBoundary>
          </TodoCommentKeyboardArea>
        </TodoAvailabilityGuard>
      </TodoCommentSession>
    </StyledSafeAreaView>
  );
}

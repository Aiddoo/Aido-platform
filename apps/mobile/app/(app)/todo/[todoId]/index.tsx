import { TodoCommentComposerBar } from '@src/features/engagement/comment/components/todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardGesture } from '@src/features/engagement/comment/components/todo-comment-keyboard-gesture';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentThreadList } from '@src/features/engagement/comment/components/todo-comment-thread-list';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailSummary } from '@src/features/engagement/comment/components/todo-detail-summary';
import { useTodoCommentParams } from '@src/features/engagement/comment/hooks/use-todo-comment-params';
import { TodoAvailabilityGuard } from '@src/features/planning/todo/components/todo-availability-guard';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

export default function TodoDetailScreen() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());
  const [{ sort, comment }] = useTodoCommentParams();
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
    </StyledSafeAreaView>
  );
}

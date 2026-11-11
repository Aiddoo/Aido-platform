import { TodoCommentComposerBar } from '@src/features/engagement/comment/components/todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentKeyboardGesture } from '@src/features/engagement/comment/components/todo-comment-keyboard-gesture';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentThreadList } from '@src/features/engagement/comment/components/todo-comment-thread-list';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { TodoDetailSummary } from '@src/features/engagement/comment/components/todo-detail-summary';
import { useTodoCommentParams } from '@src/features/engagement/comment/hooks/use-todo-comment-params';
import { TodoAvailabilityGuard } from '@src/features/planning/todo/components/todo-availability-guard';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';
import { Suspense } from 'react';

export default function TodoDetailRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <TodoDetailScreen />;
}

function TodoDetailScreen() {
  const [todoId] = useTodoId();
  const [{ sort, comment }] = useTodoCommentParams();
  const goBack = useSingleTap(router.back);

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

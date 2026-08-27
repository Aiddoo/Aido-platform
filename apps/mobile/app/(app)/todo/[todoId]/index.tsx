import { TodoCommentComposerBar } from '@src/features/todo-comment/presentations/components/TodoCommentComposerBar/TodoCommentComposerBar';
import { TodoCommentConversationList } from '@src/features/todo-comment/presentations/components/TodoCommentConversationList/TodoCommentConversationList';
import { TodoCommentOverviewList } from '@src/features/todo-comment/presentations/components/TodoCommentOverviewList/TodoCommentOverviewList';
import { TodoCommentSortBar } from '@src/features/todo-comment/presentations/components/TodoCommentSortBar';
import { TodoCommentTitleBar } from '@src/features/todo-comment/presentations/components/TodoCommentTitleBar';
import { useCommentRouteState } from '@src/features/todo-comment/presentations/hooks/use-comment-route-state';
import { useCommentScreenBackHandler } from '@src/features/todo-comment/presentations/hooks/use-comment-screen-back-handler';
import { useIsTodoCommentComposerMutating } from '@src/features/todo-comment/presentations/hooks/use-is-todo-comment-composer-mutating';
import { TodoCommentScreenTransitionProvider } from '@src/features/todo-comment/presentations/providers/todo-comment-screen-transition';
import { TodoDetailCard } from '@src/features/todo/presentations/components/TodoDetailCard';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import {
  Box,
  QueryErrorBoundary,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export default function TodoDetailScreen() {
  return (
    <TodoCommentScreenTransitionProvider>
      <TodoDetailPage />
    </TodoCommentScreenTransitionProvider>
  );
}

function TodoDetailPage() {
  const { todoId } = useTodoScreenParams();
  const { sort, mode, anchorCommentId } = useCommentRouteState();
  useCommentScreenBackHandler();
  const commentListExtraPadding = useSharedValue(0);
  const isCommentSubmitting = useIsTodoCommentComposerMutating();
  const showsCommentOverview = mode === 'overview' || mode === 'create';
  const isNativeBackGestureEnabled = mode === 'overview' && !isCommentSubmitting;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: isNativeBackGestureEnabled }} />

      <StyledSafeAreaView className="flex-1 bg-background" edges={['top']}>
        <TodoCommentTitleBar />

        <Separator />

        {showsCommentOverview ? (
          <QueryErrorBoundary fallback={TodoCommentOverviewError} resetKeys={[todoId, sort]}>
            <TodoCommentOverviewList
              extraContentPadding={commentListExtraPadding}
              ListHeaderComponent={
                <>
                  <TodoDetailCardSection />
                  <Separator />
                  <Box px={16} py={6}>
                    <TodoCommentSortBar />
                  </Box>
                  <Separator />
                </>
              }
            />
          </QueryErrorBoundary>
        ) : (
          <QueryErrorBoundary
            fallback={TodoCommentConversationError}
            resetKeys={[todoId, sort, anchorCommentId]}
          >
            <Suspense
              fallback={
                <Box flex={1}>
                  <TodoCommentConversationList.Loading />
                </Box>
              }
            >
              <TodoCommentConversationList
                extraContentPadding={commentListExtraPadding}
                ListHeaderComponent={
                  <>
                    <TodoDetailCardSection />
                    <Separator />
                  </>
                }
              />
            </Suspense>
          </QueryErrorBoundary>
        )}

        <QueryErrorBoundary resetKeys={[todoId, mode, anchorCommentId]}>
          <TodoCommentComposerBar extraContentPadding={commentListExtraPadding} />
        </QueryErrorBoundary>
      </StyledSafeAreaView>
    </>
  );
}

function TodoDetailCardSection() {
  const { todoId } = useTodoScreenParams();

  return (
    <QueryErrorBoundary resetKeys={[todoId]}>
      <Suspense
        fallback={
          <Box px={16} py={18}>
            <TodoDetailCard.Loading />
          </Box>
        }
      >
        <Box px={16} py={18}>
          <TodoDetailCard />
        </Box>
      </Suspense>
    </QueryErrorBoundary>
  );
}

function TodoCommentOverviewError(props: QueryErrorFallbackProps) {
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <TodoDetailCardSection />
      <Separator />
      <Box px={16} py={6}>
        <TodoCommentSortBar />
      </Box>
      <Separator />
      <TodoCommentOverviewList.Error {...props} />
    </ScrollView>
  );
}

function TodoCommentConversationError(props: QueryErrorFallbackProps) {
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <TodoDetailCardSection />
      <Separator />
      <TodoCommentConversationList.Error {...props} />
    </ScrollView>
  );
}

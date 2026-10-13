import { TodoCommentScreenTransitionProvider } from '@src/features/todo-comment/components/providers/todo-comment-screen-transition-provider';
import { TodoCommentConversationList } from '@src/features/todo-comment/components/todo-comment-conversation-list/todo-comment-conversation-list';
import { TodoCommentInputBar } from '@src/features/todo-comment/components/todo-comment-input-bar/todo-comment-input-bar';
import { TodoCommentKeyboardScrollView } from '@src/features/todo-comment/components/todo-comment-keyboard-scroll-view';
import { TodoCommentOverviewList } from '@src/features/todo-comment/components/todo-comment-overview-list/todo-comment-overview-list';
import { TodoCommentSortBar } from '@src/features/todo-comment/components/todo-comment-sort-bar';
import { TodoCommentTitleBar } from '@src/features/todo-comment/components/todo-comment-title-bar';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '@src/features/todo-comment/constants/todo-comment-input';
import { useAndroidTodoCommentBackHandler } from '@src/features/todo-comment/hooks/use-android-todo-comment-back-handler';
import { useIsTodoCommentSubmitting } from '@src/features/todo-comment/hooks/use-is-todo-comment-submitting';
import { useTodoCommentRoute } from '@src/features/todo-comment/hooks/use-todo-comment-route';
import { TodoDetailCard } from '@src/features/todo/components/todo-detail-card';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import {
  Box,
  QueryErrorBoundary,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardGestureArea } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

const styles = StyleSheet.create({
  keyboardGestureArea: { flex: 1 },
  keyboardScrollView: { flex: 1 },
});

function TodoDetailScreen() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  useAndroidTodoCommentBackHandler();
  const commentListExtraPadding = useSharedValue(0);
  const isCommentSubmitting = useIsTodoCommentSubmitting();
  const selectedCommentId =
    commentRoute.view === 'conversation' ? commentRoute.commentId : undefined;
  const activeFormType = commentRoute.form?.type;
  const isNativeBackGestureEnabled =
    commentRoute.view === 'overview' && commentRoute.form === null && !isCommentSubmitting;

  const listHeader = (
    <>
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
      <Separator />
      {commentRoute.view === 'overview' && (
        <>
          <Box px={16} py={6}>
            <TodoCommentSortBar />
          </Box>
          <Separator />
        </>
      )}
    </>
  );

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: isNativeBackGestureEnabled }} />

      <StyledSafeAreaView className="flex-1 bg-background" edges={['top']}>
        <TodoCommentTitleBar />

        <Separator />

        <KeyboardGestureArea
          style={styles.keyboardGestureArea}
          textInputNativeID={TODO_COMMENT_INPUT_NATIVE_ID}
        >
          <Box flex={1}>
            <QueryErrorBoundary
              resetKeys={[todoId, commentRoute.view, commentRoute.sort, selectedCommentId]}
              fallback={(props) => (
                <TodoCommentListError {...props} extraContentPadding={commentListExtraPadding}>
                  {listHeader}
                </TodoCommentListError>
              )}
            >
              {match(commentRoute.view)
                .with('overview', () => (
                  <TodoCommentOverviewList
                    extraContentPadding={commentListExtraPadding}
                    ListHeaderComponent={listHeader}
                  />
                ))
                .with('conversation', () => (
                  <Suspense
                    fallback={
                      <Box flex={1}>
                        <TodoCommentConversationList.Loading />
                      </Box>
                    }
                  >
                    <TodoCommentConversationList
                      extraContentPadding={commentListExtraPadding}
                      ListHeaderComponent={listHeader}
                    />
                  </Suspense>
                ))
                .exhaustive()}
            </QueryErrorBoundary>

            <QueryErrorBoundary resetKeys={[todoId, activeFormType, selectedCommentId]}>
              <TodoCommentInputBar extraContentPadding={commentListExtraPadding} />
            </QueryErrorBoundary>
          </Box>
        </KeyboardGestureArea>
      </StyledSafeAreaView>
    </>
  );
}

interface TodoCommentListErrorProps extends QueryErrorFallbackProps {
  extraContentPadding: SharedValue<number>;
  children: ReactNode;
}

function TodoCommentListError({
  children,
  extraContentPadding,
  ...props
}: TodoCommentListErrorProps) {
  const [commentRoute] = useTodoCommentRoute();

  return (
    <TodoCommentKeyboardScrollView
      extraContentPadding={extraContentPadding}
      style={styles.keyboardScrollView}
      showsVerticalScrollIndicator={false}
    >
      {children}
      {match(commentRoute.view)
        .with('overview', () => <TodoCommentOverviewList.Error {...props} />)
        .with('conversation', () => <TodoCommentConversationList.Error {...props} />)
        .exhaustive()}
    </TodoCommentKeyboardScrollView>
  );
}

export default function TodoDetailRoute() {
  return (
    <TodoCommentScreenTransitionProvider>
      <TodoDetailScreen />
    </TodoCommentScreenTransitionProvider>
  );
}

import { TodoCommentConversationList } from '@src/features/todo-comment/presentations/components/TodoCommentConversationList/TodoCommentConversationList';
import { TodoCommentInputBar } from '@src/features/todo-comment/presentations/components/TodoCommentInputBar/TodoCommentInputBar';
import { TodoCommentKeyboardScrollView } from '@src/features/todo-comment/presentations/components/TodoCommentKeyboardScrollView';
import { TodoCommentOverviewList } from '@src/features/todo-comment/presentations/components/TodoCommentOverviewList/TodoCommentOverviewList';
import { TodoCommentSortBar } from '@src/features/todo-comment/presentations/components/TodoCommentSortBar';
import { TodoCommentTitleBar } from '@src/features/todo-comment/presentations/components/TodoCommentTitleBar';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '@src/features/todo-comment/presentations/constants/todo-comment-input.constants';
import { useAndroidTodoCommentBackHandler } from '@src/features/todo-comment/presentations/hooks/use-android-todo-comment-back-handler';
import { useIsTodoCommentSubmitting } from '@src/features/todo-comment/presentations/hooks/use-is-todo-comment-submitting';
import { useTodoCommentRoute } from '@src/features/todo-comment/presentations/hooks/use-todo-comment-route';
import { TodoCommentScreenTransitionProvider } from '@src/features/todo-comment/presentations/providers/todo-comment-screen-transition-provider';
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
import { StyleSheet } from 'react-native';
import { KeyboardGestureArea } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  keyboardGestureArea: { flex: 1 },
  keyboardScrollView: { flex: 1 },
});

export default function TodoDetailScreen() {
  return (
    <TodoCommentScreenTransitionProvider>
      <TodoDetailPage />
    </TodoCommentScreenTransitionProvider>
  );
}

function TodoDetailPage() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  useAndroidTodoCommentBackHandler();
  const commentListExtraPadding = useSharedValue(0);
  const isCommentSubmitting = useIsTodoCommentSubmitting();
  const selectedCommentId =
    commentRoute.view === 'conversation' ? commentRoute.commentId : undefined;
  const activeFormType = commentRoute.form?.type;
  const showsCommentOverview = commentRoute.view === 'overview';
  const isNativeBackGestureEnabled =
    commentRoute.view === 'overview' && commentRoute.form === null && !isCommentSubmitting;

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
            {showsCommentOverview ? (
              <QueryErrorBoundary
                fallback={(props) => (
                  <TodoCommentOverviewError
                    {...props}
                    extraContentPadding={commentListExtraPadding}
                  />
                )}
                resetKeys={[todoId, commentRoute.sort]}
              >
                <TodoCommentOverviewList
                  extraContentPadding={commentListExtraPadding}
                  ListHeaderComponent={<TodoCommentOverviewHeader />}
                />
              </QueryErrorBoundary>
            ) : (
              <QueryErrorBoundary
                fallback={(props) => (
                  <TodoCommentConversationError
                    {...props}
                    extraContentPadding={commentListExtraPadding}
                  />
                )}
                resetKeys={[todoId, commentRoute.sort, selectedCommentId]}
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
                    ListHeaderComponent={<TodoCommentConversationHeader />}
                  />
                </Suspense>
              </QueryErrorBoundary>
            )}

            <QueryErrorBoundary resetKeys={[todoId, activeFormType, selectedCommentId]}>
              <TodoCommentInputBar extraContentPadding={commentListExtraPadding} />
            </QueryErrorBoundary>
          </Box>
        </KeyboardGestureArea>
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

function TodoCommentOverviewHeader() {
  return (
    <>
      <TodoDetailCardSection />
      <Separator />
      <Box px={16} py={6}>
        <TodoCommentSortBar />
      </Box>
      <Separator />
    </>
  );
}

function TodoCommentConversationHeader() {
  return (
    <>
      <TodoDetailCardSection />
      <Separator />
    </>
  );
}

interface TodoCommentErrorProps extends QueryErrorFallbackProps {
  extraContentPadding: SharedValue<number>;
}

function TodoCommentOverviewError({ extraContentPadding, ...props }: TodoCommentErrorProps) {
  return (
    <TodoCommentKeyboardScrollView
      extraContentPadding={extraContentPadding}
      style={styles.keyboardScrollView}
      showsVerticalScrollIndicator={false}
    >
      <TodoCommentOverviewHeader />
      <TodoCommentOverviewList.Error {...props} />
    </TodoCommentKeyboardScrollView>
  );
}

function TodoCommentConversationError({ extraContentPadding, ...props }: TodoCommentErrorProps) {
  return (
    <TodoCommentKeyboardScrollView
      extraContentPadding={extraContentPadding}
      style={styles.keyboardScrollView}
      showsVerticalScrollIndicator={false}
    >
      <TodoCommentConversationHeader />
      <TodoCommentConversationList.Error {...props} />
    </TodoCommentKeyboardScrollView>
  );
}

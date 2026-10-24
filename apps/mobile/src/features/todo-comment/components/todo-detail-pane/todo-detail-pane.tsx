import { TodoDetailCard } from '@src/features/todo/components/todo-detail-card';
import { useFeedSelectedTodo } from '@src/features/todo/hooks/use-feed-selected-todo';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useTranslation } from '@src/shared/i18n';
import { KeyboardBottomGapProvider } from '@src/shared/providers/keyboard-bottom-gap-provider';
import {
  Box,
  DocsIcon,
  QueryErrorBoundary,
  Result,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense, useCallback, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardGestureArea } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment-input';
import { useAndroidTodoCommentBackHandler } from '../../hooks/use-android-todo-comment-back-handler';
import { useIsTodoCommentSubmitting } from '../../hooks/use-is-todo-comment-submitting';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { TodoCommentScreenTransitionProvider } from '../providers/todo-comment-screen-transition-provider';
import { TodoCommentConversationList } from '../todo-comment-conversation-list/todo-comment-conversation-list';
import { TodoCommentInputBar } from '../todo-comment-input-bar/todo-comment-input-bar';
import { TodoCommentKeyboardScrollView } from '../todo-comment-keyboard-scroll-view';
import { TodoCommentOverviewList } from '../todo-comment-overview-list/todo-comment-overview-list';
import { TodoCommentSortBar } from '../todo-comment-sort-bar';
import { TodoCommentTitleBar } from '../todo-comment-title-bar';

const styles = StyleSheet.create({
  keyboardGestureArea: { flex: 1 },
  keyboardScrollView: { flex: 1 },
});

interface TodoDetailPaneProps {
  /** `screen`은 `/todo/[todoId]` 전체 화면, `pane`은 펼친 피드의 오른쪽 상세 영역이다. */
  presentation: 'screen' | 'pane';
}

/** 할 일 식별자는 route의 `todoId`를 읽는다. 상세 라우트는 pathname, 피드 pane은 같은 이름의 search param이다. */
export function TodoDetailPane({ presentation }: TodoDetailPaneProps) {
  return (
    <TodoCommentScreenTransitionProvider>
      <TodoDetailContent presentation={presentation} />
    </TodoCommentScreenTransitionProvider>
  );
}

TodoDetailPane.Empty = function Empty() {
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-background px-8">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('detail.emptyTitle')}
        description={t('detail.selectPrompt')}
      />
    </StyledSafeAreaView>
  );
};

function TodoDetailContent({ presentation }: TodoDetailPaneProps) {
  const { todoId } = useTodoScreenParams();
  const [_selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const [commentRoute] = useTodoCommentRoute();
  const isPane = presentation === 'pane';
  const closePane = useCallback(() => setSelectedTodoId(undefined), [setSelectedTodoId]);
  useAndroidTodoCommentBackHandler({ onExit: isPane ? closePane : undefined });
  const commentListExtraPadding = useSharedValue(0);
  const isCommentSubmitting = useIsTodoCommentSubmitting();
  const selectedCommentId =
    commentRoute.view === 'conversation' ? commentRoute.commentId : undefined;
  const activeFormType = commentRoute.form?.type;
  const isNativeBackGestureEnabled =
    commentRoute.view === 'overview' && commentRoute.form == null && !isCommentSubmitting;

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

  const content = (
    <>
      {isPane ? (
        <TodoCommentTitleBar onBackPress={closePane} />
      ) : (
        <TodoCommentTitleBar.StackHeader />
      )}

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
    </>
  );

  if (isPane) {
    return (
      <KeyboardBottomGapProvider>
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
          {content}
        </StyledSafeAreaView>
      </KeyboardBottomGapProvider>
    );
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: isNativeBackGestureEnabled }} />

      <StyledSafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
        {content}
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

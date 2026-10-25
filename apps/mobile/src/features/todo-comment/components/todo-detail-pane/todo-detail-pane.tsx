import { useLogger } from '@src/bootstrap/providers/di-context';
import { TodoDetailCard } from '@src/features/todo/components/todo-detail-card';
import { useFeedSelectedTodo } from '@src/features/todo/hooks/use-feed-selected-todo';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { isApiError } from '@src/shared/errors';
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
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense, useCallback, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardController, KeyboardGestureArea } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment-input';
import { TODO_COMMENT_LOG_EVENT } from '../../constants/todo-comment-log-events';
import { useAndroidTodoCommentBackHandler } from '../../hooks/use-android-todo-comment-back-handler';
import { useTodoCommentBack } from '../../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import type { TodoCommentPresentation } from '../../utils/navigation/todo-comment-route';
import { TodoCommentPresentationProvider } from '../providers/todo-comment-presentation-provider';
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
  /**
   * `screen`은 Stack 화면(`/todo/[todoId]` 댓글 개요, `/todo/[todoId]/comments/[commentId]` 대화),
   * `pane`은 펼친 피드의 오른쪽 상세 영역이다.
   */
  presentation: TodoCommentPresentation;
}

/** 할 일 식별자는 route의 `todoId`를 읽는다. 상세 라우트는 pathname, 피드 pane은 같은 이름의 search param이다. */
export function TodoDetailPane({ presentation }: TodoDetailPaneProps) {
  return (
    <TodoCommentPresentationProvider presentation={presentation}>
      <TodoCommentScreenTransitionProvider>
        <TodoDetailContent presentation={presentation} />
      </TodoCommentScreenTransitionProvider>
    </TodoCommentPresentationProvider>
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

/** 지워졌거나 더는 볼 수 없는 할 일(친구 끊김·차단 등). 알림·위젯이 예전 할 일을 열 때 보인다. */
TodoDetailPane.Unavailable = function Unavailable({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-background px-8">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('todo:detail.unavailableTitle')}
        description={t('todo:detail.unavailableDescription')}
        button={<Result.Button onPress={onClose}>{t('common:actions.goBack')}</Result.Button>}
      />
    </StyledSafeAreaView>
  );
};

function TodoDetailContent({ presentation }: TodoDetailPaneProps) {
  const { todoId } = useTodoScreenParams();
  // 서버는 지운 할 일과 볼 권한이 없는 할 일을 모두 404로 답한다. 본문·댓글 대신 안내 하나만 보인다
  const { error: todoDetailsError } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const isTodoUnavailable = isApiError(todoDetailsError) && todoDetailsError.status === 404;
  const [_selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const [commentRoute] = useTodoCommentRoute();
  const isPane = presentation === 'pane';
  const closePane = useCallback(() => setSelectedTodoId(undefined), [setSelectedTodoId]);
  useAndroidTodoCommentBackHandler({ onExit: isPane ? closePane : undefined });
  useDismissKeyboardOnBlur();
  const commentListExtraPadding = useSharedValue(0);
  const { result: backResult } = useTodoCommentBack();
  const selectedCommentId =
    commentRoute.view === 'conversation' ? commentRoute.commentId : undefined;
  const activeFormType = commentRoute.form?.type;
  // 뒤로가기가 Stack pop일 때만 swipe를 연다. 작성기 닫기 같은 화면 안 단계를 swipe가 건너뛰지 않는다.
  const isNativeBackGestureEnabled = backResult.status === 'native';

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
      {isPane ? <TodoCommentTitleBar /> : <TodoCommentTitleBar.StackHeader />}

      <Separator />

      {isTodoUnavailable ? (
        <TodoDetailPane.Unavailable onClose={isPane ? closePane : router.back} />
      ) : (
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
      )}
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

/**
 * 작성 중에 알림이나 다른 화면이 위에 쌓이면 가려진 작성기가 first responder로 남아 새 화면 위에 키보드가
 * 떠 있다. 화면이 focus를 잃을 때 키보드를 내린다. 작성 내용은 초안 저장소에 남는다.
 */
function useDismissKeyboardOnBlur() {
  const logger = useLogger();

  useFocusEffect(
    useCallback(
      () => () => {
        KeyboardController.dismiss().catch((error) =>
          logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, { error }),
        );
      },
      [logger],
    ),
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

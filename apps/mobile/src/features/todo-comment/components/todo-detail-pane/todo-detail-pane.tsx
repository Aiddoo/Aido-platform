import type { TodoCommentSort } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogger, useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { TodoDetailCard } from '@src/features/todo/components/todo-detail-card';
import { useFeedSelectedTodo } from '@src/features/todo/hooks/use-feed-selected-todo';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage, isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { KeyboardBottomGapProvider } from '@src/shared/providers/keyboard-bottom-gap-provider';
import {
  Box,
  DocsIcon,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Separator } from 'heroui-native';
import { type ReactNode, Suspense, useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { KeyboardController, KeyboardGestureArea } from 'react-native-keyboard-controller';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

import { TODO_COMMENT_LOG_EVENT } from '../../constants/todo-comment-log-events';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment.constants';
import {
  todoCommentComposerFormSchema,
  TodoCommentComposer,
} from '../../domains/todo-comment-composer.model';
import { useAndroidTodoCommentBackHandler } from '../../hooks/use-android-todo-comment-back-handler';
import { useTodoCommentBack } from '../../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { getTodoCommentThreadsInfiniteQueryOptions } from '../../queries/get-todo-comment-threads-infinite-query-options';
import { TodoCommentComposerBar } from '../todo-comment-composer/todo-comment-composer-bar';
import { TodoCommentExpansionProvider } from '../todo-comment-expansion';
import { TodoCommentKeyboardScrollView } from '../todo-comment-keyboard-scroll-view';
import { TodoCommentRevealProvider } from '../todo-comment-reveal';
import { TodoCommentSortBar } from '../todo-comment-sort-bar';
import { TodoCommentThreadList } from '../todo-comment-thread-list';
import { TodoCommentTitleBar } from '../todo-comment-title-bar';

const NOT_FOUND_STATUS = 404;

const styles = StyleSheet.create({
  keyboardGestureArea: { flex: 1 },
  keyboardScrollView: { flex: 1 },
});

type TodoDetailPresentation = 'screen' | 'pane';

interface TodoDetailPaneProps {
  /** `screen`은 `/todo/[todoId]` Stack 화면, `pane`은 펼친 피드의 오른쪽 상세 영역이다 */
  presentation: TodoDetailPresentation;
}

/**
 * 할 일 상세 한 화면: 제목 → 할 일 본문 → 정렬 → 댓글 묶음 → 작성 바.
 * 작성기(새 댓글·답글·수정)는 이 화면이 가진 폼 하나가 소유하고, 하위는 필요한 필드만 구독한다.
 */
export function TodoDetailPane({ presentation }: TodoDetailPaneProps) {
  const composer = useForm({
    resolver: zodResolver(todoCommentComposerFormSchema),
    defaultValues: TodoCommentComposer.new(),
    mode: 'onChange',
  });

  return (
    <FormProvider {...composer}>
      <TodoCommentRevealProvider>
        <TodoCommentExpansionProvider>
          <TodoDetailContent presentation={presentation} />
        </TodoCommentExpansionProvider>
      </TodoCommentRevealProvider>
    </FormProvider>
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

/** 지워졌거나 더는 볼 수 없는 할 일(친구 끊김·차단 등). 알림·위젯이 예전 할 일을 열 때 보인다 */
TodoDetailPane.Unavailable = function Unavailable({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <StyledSafeAreaView
      edges={['left', 'right']}
      className="flex-1 bg-background px-8"
      testID="todo-unavailable"
    >
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
  const isTodoUnavailable =
    isApiError(todoDetailsError) && todoDetailsError.status === NOT_FOUND_STATUS;
  const [_selectedTodoId, setSelectedTodoId] = useFeedSelectedTodo();
  const [{ sort, comment }] = useTodoCommentRoute();
  const { result: backResult } = useTodoCommentBack();
  const isPane = presentation === 'pane';
  const closePane = useCallback(() => setSelectedTodoId(undefined), [setSelectedTodoId]);
  const extraContentPadding = useSharedValue(0);
  useAndroidTodoCommentBackHandler({ onExit: isPane ? closePane : undefined });
  useDismissKeyboardOnBlur();

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
          <Box flex={1} testID="todo-comment-threads">
            <QueryErrorBoundary
              resetKeys={[todoId, sort, comment]}
              fallback={(props) => (
                <TodoCommentListError {...props} extraContentPadding={extraContentPadding}>
                  <TodoDetailHeader />
                </TodoCommentListError>
              )}
            >
              <TodoCommentThreadList
                header={<TodoDetailHeader />}
                extraContentPadding={extraContentPadding}
              />
            </QueryErrorBoundary>
            <QueryErrorBoundary resetKeys={[todoId]}>
              <TodoCommentComposerBar extraContentPadding={extraContentPadding} />
            </QueryErrorBoundary>
          </Box>
        </KeyboardGestureArea>
      )}
    </>
  );

  if (isPane) {
    return (
      <KeyboardBottomGapProvider>
        <StyledSafeAreaView
          edges={['left', 'right']}
          className="flex-1 bg-background"
          testID="todo-detail"
        >
          {content}
        </StyledSafeAreaView>
      </KeyboardBottomGapProvider>
    );
  }

  return (
    <>
      {/* 작성기가 열려 있으면 swipe가 화면을 닫지 않고 뒤로가기가 작성기부터 닫는다 */}
      <Stack.Screen options={{ gestureEnabled: backResult === 'native' }} />
      <StyledSafeAreaView
        className="flex-1 bg-background"
        edges={['left', 'right']}
        testID="todo-detail"
      >
        {content}
      </StyledSafeAreaView>
    </>
  );
}

/** 할 일 본문과 정렬. 댓글과 함께 스크롤된다 */
function TodoDetailHeader() {
  const { todoId } = useTodoScreenParams();
  const [{ sort }, setCommentRoute] = useTodoCommentRoute();
  const changeSort = useChangeSort();

  return (
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
      <Box px={16} py={6}>
        <TodoCommentSortBar
          value={sort}
          isPending={changeSort.isPending}
          onChange={(next) =>
            changeSort.run(next, () => setCommentRoute({ sort: next, comment: null }))
          }
        />
      </Box>
      <Separator />
    </>
  );
}

/** 새 정렬의 첫 페이지를 먼저 받아 두고 바꿔 목록이 skeleton으로 깜박이지 않게 한다 */
function useChangeSort() {
  const { todoId } = useTodoScreenParams();
  const queryClient = useQueryClient();
  const service = useTodoCommentService();
  const { trackEvent } = useTrack();
  const [isPending, setIsPending] = useState(false);

  const run = (sort: TodoCommentSort, commit: () => void) => {
    setIsPending(true);
    queryClient
      .prefetchInfiniteQuery(
        getTodoCommentThreadsInfiniteQueryOptions(service, { todoId, sort, anchorCommentId: null }),
      )
      .finally(() => {
        setIsPending(false);
        commit();
        trackEvent('todo_comment_sorted', { todo_id: todoId, sort });
      })
      .catch(() => undefined);
  };

  return { isPending, run };
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
          logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
            error: getErrorMessage(error),
          }),
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
  return (
    <TodoCommentKeyboardScrollView
      extraContentPadding={extraContentPadding}
      style={styles.keyboardScrollView}
      showsVerticalScrollIndicator={false}
    >
      {children}
      <TodoCommentThreadList.Error {...props} />
    </TodoCommentKeyboardScrollView>
  );
}

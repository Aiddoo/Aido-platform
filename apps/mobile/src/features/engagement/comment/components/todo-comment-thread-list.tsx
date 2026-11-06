import { usePendingCoachmark } from '@src/features/device/coachmark/hooks/use-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  ChatBubbleIcon,
  CloseIcon,
  Flex,
  HeartFilledIcon,
  HStack,
  InfiniteList,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  Text,
  VStack,
} from '@src/shared/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { noop, range } from 'es-toolkit';
import { CloseButton, PressableFeedback, Spinner } from 'heroui-native';
import { type ComponentProps, type ReactNode, useCallback, useEffect, useRef } from 'react';
import type { ScrollViewProps } from 'react-native';
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import {
  TodoCommentPolicy,
  type TodoCommentThread,
  type TodoCommentThreadAnchor,
} from '../domains/todo-comment.model';
import { useCommentParams } from '../hooks/use-comment-params';
import { useGetTodoCommentThreadsInfiniteQueryOptions } from '../queries/get-todo-comment-threads-infinite-query-options';
import { refreshTodoComments } from '../queries/todo-comment-cache';
import { TodoCommentItem } from './todo-comment-item';
import { TodoCommentKeyboardScrollView } from './todo-comment-keyboard-scroll-view';
import { TodoCommentReplies } from './todo-comment-replies';
import { useTodoCommentReveal } from './todo-comment-reveal';
import { TodoCommentRailRow } from './todo-comment-thread-rail';

const LOADING_ROW_COUNT = 3;
const ANCHOR_VIEW_POSITION = 0.2;
const HINT_HEART_SIZE = 20;
const HINT_CLOSE_SIZE = 16;
const HINT_CLOSE_HIT_SLOP = 14;
const HINT_PULSE = { delayMs: 1_200, peakScale: 1.28 } as const;

const contentContainerStyle = { flexGrow: 1 };
const keyExtractor = (thread: TodoCommentThread) => thread.comment.id;

type ThreadListProps = ComponentProps<typeof InfiniteList<TodoCommentThread>>;

interface TodoCommentThreadListProps extends Omit<
  ThreadListProps,
  | 'data'
  | 'keyExtractor'
  | 'renderItem'
  | 'renderScrollComponent'
  | 'refreshing'
  | 'onRefresh'
  | 'hasNextPage'
  | 'isFetchingNextPage'
  | 'isFetchNextPageError'
  | 'fetchNextPage'
  | 'ListEmptyComponent'
  | 'ListHeaderComponent'
  | 'extraData'
> {
  /** 할 일 본문과 정렬처럼 댓글 위에 함께 스크롤되는 영역 */
  header: ReactNode;
  extraContentPadding: SharedValue<number>;
}

/**
 * 할 일 상세의 댓글 묶음 목록. 바깥 스크롤은 키보드를 따라가는 하나뿐이고 묶음 행만 가상화한다.
 * 알림으로 연 댓글은 그 위치가 든 페이지를 받아 그 묶음으로 옮기고 잠깐 강조한다.
 */
export function TodoCommentThreadList({
  header,
  extraContentPadding,
  ...listProps
}: TodoCommentThreadListProps) {
  const { todoId } = useTodoScreenParams();
  const { sort, comment } = useCommentParams();
  const queryClient = useQueryClient();
  const { listRef } = useTodoCommentReveal();
  const threadsQuery = useInfiniteQuery(
    useGetTodoCommentThreadsInfiniteQueryOptions({ todoId, sort, anchorCommentId: comment }),
  );
  const threads = threadsQuery.data?.threads ?? [];
  const anchor = threadsQuery.data?.anchor ?? null;
  const [isRefreshing, refresh] = useRefresh(
    useCallback(
      () =>
        Promise.all([
          invalidateTodoDetails(queryClient, { todoId }),
          refreshTodoComments({ queryClient, todoId }),
        ]),
      [queryClient, todoId],
    ),
  );
  const renderKeyboardScrollView = useCallback(
    (props: ScrollViewProps) => (
      <TodoCommentKeyboardScrollView {...props} extraContentPadding={extraContentPadding} />
    ),
    [extraContentPadding],
  );
  const renderItem = useCallback(
    ({ item }: { item: TodoCommentThread }) => <ThreadRow thread={item} anchor={anchor} />,
    [anchor],
  );

  useScrollToAnchor({ threads, anchor, isLoaded: threadsQuery.isSuccess });

  if (threadsQuery.isError && threadsQuery.data == null) {
    throw threadsQuery.error;
  }

  return (
    <InfiniteList
      {...listProps}
      ref={listRef}
      key={`${todoId}:${sort}:${comment ?? ''}`}
      data={threads}
      extraData={anchor}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderScrollComponent={renderKeyboardScrollView}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {header}
          {threads.length > 0 && <DoubleTapHint />}
          {threadsQuery.hasPreviousPage && (
            <LoadPrevious
              isLoading={threadsQuery.isFetchingPreviousPage}
              onPress={() => {
                threadsQuery.fetchPreviousPage().catch(noop);
              }}
            />
          )}
        </>
      }
      ListEmptyComponent={
        threadsQuery.isPending ? TodoCommentThreadList.Loading : TodoCommentThreadList.Empty
      }
      hasNextPage={threadsQuery.hasNextPage}
      isFetchingNextPage={threadsQuery.isFetchingNextPage}
      isFetchNextPageError={threadsQuery.isFetchNextPageError}
      fetchNextPage={threadsQuery.fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={refresh}
    />
  );
}

TodoCommentThreadList.Loading = function Loading() {
  return (
    <VStack testID="todo-comment-thread-list-loading">
      {range(LOADING_ROW_COUNT).map((index) => (
        <TodoCommentRailRow key={index} kind={{ type: 'comment', hasReplies: false }}>
          <TodoCommentItem.Loading />
        </TodoCommentRailRow>
      ))}
    </VStack>
  );
};

TodoCommentThreadList.Empty = function Empty() {
  const { t } = useTranslation('todoComment');

  return (
    <Flex flex={1} justify="center" align="center" py={32}>
      <Result
        icon={<ChatBubbleIcon width={72} height={72} colorClassName="text-gray-4" />}
        title={t('list.emptyTitle')}
        description={t('list.emptyDescription')}
      />
    </Flex>
  );
};

TodoCommentThreadList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoComment');

  return (
    <Flex flex={1} justify="center" align="center" py={32}>
      <Result title={t('list.loadFailed')} button={<QueryErrorActions onRetry={reset} />} />
    </Flex>
  );
};

/** 한 묶음: 댓글과 그 답글. 목록이 행을 재활용해도 메뉴·좋아요 상태가 다른 댓글로 넘어가지 않게 댓글마다 key로 새로 만든다. 연결선은 댓글 아바타 아래에서 마지막 답글(또는 더 보기)까지 이어진다 */
function ThreadRow({
  thread,
  anchor,
}: {
  thread: TodoCommentThread;
  anchor: TodoCommentThreadAnchor | null;
}) {
  const hasReplies = TodoCommentPolicy.hasRepliesToShow(thread);
  const isAnchoredComment = anchor?.threadCommentId === thread.comment.id && anchor.replyId == null;

  return (
    <VStack pb={8} testID={`todo-comment-thread-${thread.comment.id}`}>
      <TodoCommentRailRow kind={{ type: 'comment', hasReplies }} isHighlighted={isAnchoredComment}>
        <TodoCommentItem key={thread.comment.id} comment={thread.comment} />
      </TodoCommentRailRow>
      {hasReplies && <TodoCommentReplies key={thread.comment.id} thread={thread} anchor={anchor} />}
    </VStack>
  );
}

/** 알림으로 연 묶음으로 한 번만 옮긴다. 그 글이 사라졌으면 알리고 목록 맨 위를 보인다 */
function useScrollToAnchor({
  threads,
  anchor,
  isLoaded,
}: {
  threads: readonly TodoCommentThread[];
  anchor: TodoCommentThreadAnchor | null;
  isLoaded: boolean;
}) {
  const { comment } = useCommentParams();
  const { listRef } = useTodoCommentReveal();
  const toast = useAppToast();
  const { t } = useTranslation('todoComment');
  const handledCommentRef = useRef<string | null>(null);

  useEffect(() => {
    if (comment == null || !isLoaded || handledCommentRef.current === comment) {
      return;
    }
    handledCommentRef.current = comment;

    if (anchor == null) {
      toast.warning(t('toasts.anchorMissing'));
      return;
    }

    const index = threads.findIndex((thread) => thread.comment.id === anchor.threadCommentId);
    if (index >= 0) {
      listRef.current
        ?.scrollToIndex({ index, viewPosition: ANCHOR_VIEW_POSITION, animated: true })
        .catch(noop);
    }
  }, [anchor, comment, isLoaded, listRef, t, threads, toast]);
}

function LoadPrevious({ isLoading, onPress }: { isLoading: boolean; onPress: () => void }) {
  const { t } = useTranslation('todoComment');

  return (
    <PressableFeedback
      className="min-h-11 flex-row items-center justify-center gap-2"
      isDisabled={isLoading}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading }}
      onPress={onPress}
    >
      {isLoading && <Spinner size="sm" />}
      <Text size="e1" shade={7} weight="medium">
        {t('list.loadPrevious')}
      </Text>
    </PressableFeedback>
  );
}

/** 계정당 한 번. 처음 두 번 탭하거나 닫으면 다시 보이지 않는다 */
function DoubleTapHint() {
  const { data: user } = useQuery(useGetMeQueryOptions());

  if (user == null) {
    return null;
  }

  return <DoubleTapHint.Contents accountId={user.id} />;
}

DoubleTapHint.Contents = function Contents({ accountId }: { accountId: string }) {
  const { t } = useTranslation('todoComment');
  const { trackEvent } = useTrack();
  const [isPending, complete] = usePendingCoachmark({ accountId, kind: 'comment-double-tap' });

  if (!isPending) {
    return null;
  }

  return (
    <HStack
      gap={10}
      align="center"
      mx={16}
      mt={12}
      mb={4}
      className="rounded-xl bg-gray-2 px-3 py-2.5"
      accessibilityRole="alert"
      testID="todo-comment-double-tap-hint"
    >
      <PulsingHeart />
      <Text size="b4" shade={8} className="flex-1 shrink">
        {t('hint.doubleTap')}
      </Text>
      <CloseButton
        variant="ghost"
        className="size-4"
        hitSlop={HINT_CLOSE_HIT_SLOP}
        accessibilityLabel={t('hint.dismiss')}
        onPress={() => {
          complete();
          trackEvent('todo_comment_hint_dismissed', { kind: 'double_tap', reason: 'close' });
        }}
      >
        <CloseIcon width={HINT_CLOSE_SIZE} height={HINT_CLOSE_SIZE} colorClassName="text-gray-6" />
      </CloseButton>
    </HStack>
  );
};

function PulsingHeart() {
  const isReducedMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (isReducedMotion) {
      return;
    }
    scale.value = withRepeat(
      withSequence(withDelay(HINT_PULSE.delayMs, withSpring(HINT_PULSE.peakScale)), withSpring(1)),
      -1,
    );
    return () => cancelAnimation(scale);
  }, [isReducedMotion, scale]);

  return (
    <Animated.View style={style}>
      <HeartFilledIcon
        width={HINT_HEART_SIZE}
        height={HINT_HEART_SIZE}
        colorClassName="text-error"
      />
    </Animated.View>
  );
}

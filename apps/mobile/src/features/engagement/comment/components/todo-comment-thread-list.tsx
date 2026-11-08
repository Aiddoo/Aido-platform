import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  HeartFilledIcon,
  InfiniteList,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  Text,
  VStack,
  InlineAlert,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { noop, range } from 'es-toolkit';
import { PressableFeedback, Spinner } from 'heroui-native';
import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { type ScrollViewProps, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { TODO_COMMENT_HIGHLIGHT_DURATION_MS } from '../constants/todo-comment.constants';
import { TodoCommentPolicy } from '../domains/todo-comment.model';
import { useTodoCommentParams } from '../hooks/use-todo-comment-params';
import { invalidateTodoComments } from '../queries/todo-comment-cache';
import { useGetTodoCommentThreadsInfiniteQueryOptions } from '../queries/todo-comment.queries';
import type { TodoCommentThread, TodoCommentThreadAnchor } from '../schemas/todo-comment.schema';
import { TodoCommentItem } from './todo-comment-item';
import { TodoCommentKeyboardScrollView } from './todo-comment-keyboard-scroll-view';
import { TodoCommentReplies } from './todo-comment-replies';
import { useTodoCommentReveal } from './todo-comment-reveal';
import { TodoCommentRailRow } from './todo-comment-thread-rail';
import { TodoDetailHeader } from './todo-detail-header';

const LOADING_ROW_COUNT = 3;
const ANCHOR_VIEW_POSITION = 0.2;
const HINT_HEART_SIZE = 20;
const HINT_PULSE = { delayMs: 1_200, peakScale: 1.28 } as const;

const styles = StyleSheet.create({ fallbackScrollView: { flex: 1 } });

function getThreadKey(thread: TodoCommentThread) {
  return thread.comment.id;
}

type ThreadListProps = ComponentProps<typeof InfiniteList<TodoCommentThread>>;

type TodoCommentThreadListProps = Omit<
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
>;

function renderThreadListScrollView(props: ScrollViewProps) {
  return <TodoCommentKeyboardScrollView {...props} />;
}

/**
 * 할 일 상세의 댓글 묶음 목록. 바깥 스크롤은 키보드를 따라가는 하나뿐이고 묶음 행만 가상화한다.
 * 알림으로 연 댓글은 그 위치가 든 페이지를 받아 그 묶음으로 옮기고 잠깐 강조한다.
 */
export function TodoCommentThreadList(listProps: TodoCommentThreadListProps) {
  const [todoId] = useTodoId();
  const [{ sort, comment }] = useTodoCommentParams();
  const queryClient = useQueryClient();
  const { listRef } = useTodoCommentReveal();
  const threadsQuery = useSuspenseInfiniteQuery(
    useGetTodoCommentThreadsInfiniteQueryOptions({
      todoId,
      sort,
      anchorCommentId: comment ?? null,
    }),
  );
  const { threads, anchor } = threadsQuery.data;
  const [isRefreshing, handleRefresh] = useRefresh(
    useCallback(
      () =>
        Promise.all([
          invalidateTodoDetails(queryClient, { todoId }),
          invalidateTodoComments(queryClient, { todoId }),
        ]),
      [queryClient, todoId],
    ),
  );
  const isHighlightActive = useScrollToAnchor({ threads, anchor });
  const renderItem = useCallback(
    ({ item }: { item: TodoCommentThread }) => (
      <ThreadRow thread={item} anchor={anchor} isHighlightActive={isHighlightActive} />
    ),
    [anchor, isHighlightActive],
  );

  return (
    <InfiniteList
      {...listProps}
      ref={listRef}
      key={`${todoId}:${sort}:${comment ?? ''}`}
      data={threads}
      extraData={isHighlightActive ? anchor : null}
      keyExtractor={getThreadKey}
      renderItem={renderItem}
      renderScrollComponent={renderThreadListScrollView}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <TodoDetailHeader />
          {threads.length > 0 && <DoubleTapHint className="mx-4 mb-1 mt-3" />}
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
      ListEmptyComponent={TodoCommentThreadList.Empty}
      hasNextPage={threadsQuery.hasNextPage}
      isFetchingNextPage={threadsQuery.isFetchingNextPage}
      isFetchNextPageError={threadsQuery.isFetchNextPageError}
      fetchNextPage={threadsQuery.fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

TodoCommentThreadList.Loading = function Loading() {
  return (
    <TodoCommentKeyboardScrollView
      style={styles.fallbackScrollView}
      showsVerticalScrollIndicator={false}
    >
      <TodoDetailHeader />
      <VStack testID="todo-comment-thread-list-loading">
        {range(LOADING_ROW_COUNT).map((index) => (
          <TodoCommentRailRow key={index} kind={{ type: 'comment', hasReplies: false }}>
            <TodoCommentItem.Loading />
          </TodoCommentRailRow>
        ))}
      </VStack>
    </TodoCommentKeyboardScrollView>
  );
};

TodoCommentThreadList.Empty = function Empty() {
  const { t } = useTranslation('todoComment');

  return (
    <Box px={16} py={8}>
      <Text size="b4" shade={6}>
        {t('list.emptyDescription')}
      </Text>
    </Box>
  );
};

TodoCommentThreadList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoComment');

  return (
    <TodoCommentKeyboardScrollView
      style={styles.fallbackScrollView}
      showsVerticalScrollIndicator={false}
    >
      <TodoDetailHeader />
      <HStack flex={1} justify="center" align="center" py={32}>
        <Result title={t('list.loadFailed')} button={<QueryErrorActions onRetry={reset} />} />
      </HStack>
    </TodoCommentKeyboardScrollView>
  );
};

/** 한 묶음: 댓글과 그 답글. 목록이 행을 재활용해도 메뉴·좋아요 상태가 다른 댓글로 넘어가지 않게 댓글마다 key로 새로 만든다. 연결선은 댓글 아바타 아래에서 마지막 답글(또는 더 보기)까지 이어진다 */
function ThreadRow({
  thread,
  anchor,
  isHighlightActive,
}: {
  thread: TodoCommentThread;
  anchor: TodoCommentThreadAnchor | null;
  isHighlightActive: boolean;
}) {
  const hasReplies = TodoCommentPolicy.hasRepliesToShow(thread);
  const isAnchoredComment =
    isHighlightActive && anchor?.threadCommentId === thread.comment.id && anchor.replyId == null;

  return (
    <VStack pb={8} testID={`todo-comment-thread-${thread.comment.id}`}>
      <TodoCommentRailRow kind={{ type: 'comment', hasReplies }} isHighlighted={isAnchoredComment}>
        <TodoCommentItem key={thread.comment.id} comment={thread.comment} />
      </TodoCommentRailRow>
      {hasReplies && (
        <TodoCommentReplies
          key={thread.comment.id}
          thread={thread}
          anchor={anchor}
          isHighlightActive={isHighlightActive}
        />
      )}
    </VStack>
  );
}

/**
 * 알림으로 연 묶음으로 한 번만 옮기고, 그 행의 강조도 그 한 번의 시간 동안만 켠다. 그 글이 사라졌으면 알리고 목록 맨 위를 보인다.
 * 행이 재활용되어 다시 그려져도 강조와 올림이 되풀이되지 않게 켜짐 여부를 목록이 소유한다
 */
function useScrollToAnchor({
  threads,
  anchor,
}: {
  threads: readonly TodoCommentThread[];
  anchor: TodoCommentThreadAnchor | null;
}): boolean {
  const [{ comment }] = useTodoCommentParams();
  const { listRef } = useTodoCommentReveal();
  const [isHighlightActive, setIsHighlightActive] = useState(false);
  const toast = useAppToast();
  const { t } = useTranslation('todoComment');
  const handledCommentRef = useRef<string | null>(null);

  useEffect(() => {
    if (comment == null || handledCommentRef.current === comment) {
      return;
    }
    handledCommentRef.current = comment;

    if (anchor == null) {
      toast.warning(t('toasts.anchorMissing'));

      return;
    }

    setIsHighlightActive(true);
    const index = threads.findIndex((thread) => thread.comment.id === anchor.threadCommentId);
    if (index >= 0) {
      listRef.current
        ?.scrollToIndex({ index, viewPosition: ANCHOR_VIEW_POSITION, animated: true })
        .catch(noop);
    }
  }, [anchor, comment, listRef, t, threads, toast]);

  useEffect(() => {
    if (!isHighlightActive) {
      return;
    }
    const timer = setTimeout(() => setIsHighlightActive(false), TODO_COMMENT_HIGHLIGHT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [isHighlightActive]);

  return isHighlightActive;
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
function DoubleTapHint({ className }: { className?: string }) {
  const { t } = useTranslation('todoComment');
  const { trackEvent } = useTrack();
  const [isPending, complete] = useMyPendingCoachmark('comment-double-tap');

  if (!isPending) {
    return null;
  }

  return (
    <InlineAlert
      accessibilityRole="alert"
      testID="todo-comment-double-tap-hint"
      className={className}
      image={<PulsingHeart />}
      description={t('hint.doubleTap')}
      onClose={() => {
        complete();
        trackEvent('todo_comment_hint_dismissed', { kind: 'double_tap', reason: 'close' });
      }}
      closeLabel={t('hint.dismiss')}
    />
  );
}

function PulsingHeart() {
  const isReducedMotion = useIsReduceMotionEnabled();
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

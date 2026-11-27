import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api/vocabulary';
import { useDeviceTraits } from '@src/bootstrap/providers/di-context';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  ArrowRightIcon,
  Box,
  CommentIllustration,
  HeartFilledIcon,
  HStack,
  InfiniteList,
  InlineAlert,
  MenuContent,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { formatCompactCount } from '@src/shared/utils/number-format';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import { noop, range } from 'es-toolkit';
import { useIsFocused } from 'expo-router';
import { Menu, type MenuKey, PressableFeedback, Separator, Spinner } from 'heroui-native';
import { type ComponentProps, type Ref, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type ScrollViewProps, StyleSheet } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import type Reanimated from 'react-native-reanimated';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  type TodoCommentThread,
  type TodoCommentThreadAnchor,
  TodoCommentThreadPolicy,
} from '../domains/todo-comment-thread.model';
import { useThreadExpansion } from '../hooks/use-todo-comment-expansion';
import { useTodoCommentParams, useTodoCommentSort } from '../hooks/use-todo-comment-params';
import { useTodoCommentReveal } from '../hooks/use-todo-comment-reveal';
import { ensureTodoCommentReplies, invalidateTodoComments } from '../queries/todo-comment-cache';
import { usePrefetchTodoCommentThreadsMutationOptions } from '../queries/todo-comment.mutations';
import {
  useGetTodoCommentRepliesInfiniteQueryOptions,
  useGetTodoCommentThreadsInfiniteQueryOptions,
} from '../queries/todo-comment.queries';
import { getReplyFooter } from '../utils/todo-comment-replies.view-model';
import { TodoCommentItem } from './todo-comment-item';
import { TodoDetailSummary } from './todo-detail-summary';

const SORT_MENU_WIDTH = 208;
const LOADING_ROW_COUNT = 3;
const ANCHOR_VIEW_POSITION = 0.2;
const HINT_HEART_SIZE = 20;
const HINT_PULSE = { delayMs: 1_200, peakScale: 1.28 } as const;

const styles = StyleSheet.create({ fallbackScrollView: { flex: 1 } });

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

/** 바깥 스크롤은 키보드를 따라가는 하나뿐이고 묶음 행만 가상화한다 */
export function TodoCommentThreadList(props: TodoCommentThreadListProps) {
  const { t } = useTranslation('todoComment');
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
  const [isRefreshing, handleRefresh] = useRefresh(() =>
    Promise.all([
      invalidateTodoDetails(queryClient, { todoId }),
      invalidateTodoComments(queryClient, { todoId }),
    ]),
  );
  useScrollToAnchor({ threads, anchor });
  useScrollToTopOnSortChange(sort);
  // 강조는 행이 자기 댓글 것만 구독해, 켜지고 꺼져도 이 함수와 목록은 그대로다
  const renderItem = ({ item }: { item: TodoCommentThread }) => (
    <TodoCommentThreadList.Item thread={item} anchor={anchor} />
  );

  return (
    <InfiniteList
      {...props}
      ref={listRef}
      // 알림으로 연 댓글이 바뀌면 새 위치로 처음부터 그린다. 정렬은 미리 받은 목록이라 다시 마운트하지 않는다(FlashList가 다시 재는 동안 행이 빈다)
      key={[todoId, comment].join(':')}
      data={threads}
      keyExtractor={getThreadKey}
      renderItem={renderItem}
      renderScrollComponent={renderThreadListScrollView}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <TodoCommentThreadList.Header />
          {threads.length > 0 && <DoubleTapHint className="mx-4 mt-3 mb-1" />}
          {threadsQuery.hasPreviousPage && (
            <TodoCommentItem.More
              label={t('list.loadPrevious')}
              isLoading={threadsQuery.isFetchingPreviousPage}
              onPress={() => {
                // 실패는 조회 캐시가 보고하고 버튼이 그대로 남아 다시 누를 수 있다
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

/** 할 일 본문과 댓글 수·정렬. 댓글과 함께 스크롤된다. 상세를 기다리는 동안은 목록을 감싼 경계 하나(`TodoCommentPane`)가 받는다 */
TodoCommentThreadList.Header = function Header() {
  return (
    <>
      {/* oxlint-disable-next-line aido/spacing-scale -- 할 일 상세 머리 세로 여백. 규격 단계 사이 18px을 쓴다 */}
      <Box px={16} py={18}>
        <TodoDetailSummary />
      </Box>

      <Separator />

      <TodoCommentThreadList.Toolbar />
    </>
  );
};

/** 댓글 수와 정렬. 상세를 기다리지 않아 로딩 중에도 같은 자리에 그린다 */
TodoCommentThreadList.Toolbar = function Toolbar() {
  const [todoId] = useTodoId();
  const [sort, setSort] = useTodoCommentSort();
  const { trackEvent } = useTrack();
  const sortChange = useSortChange();

  return (
    <HStack justify="between" align="center" gap={12} px={16} py={4}>
      <CommentCount />
      <TodoCommentThreadList.SortBar
        value={sort}
        isLoading={sortChange.isPending}
        onChange={(next) =>
          sortChange.prefetchThenCommit(next, () => {
            setSort(next);
            trackEvent('todo_comment_sorted', { todo_id: todoId, sort: next });
          })
        }
      />
    </HStack>
  );
};

interface TodoCommentThreadListSortBarProps {
  value: TodoCommentSort;
  onChange: (value: TodoCommentSort) => void;
  isLoading?: boolean;
}

TodoCommentThreadList.SortBar = function SortBar({
  value,
  onChange,
  isLoading = false,
}: TodoCommentThreadListSortBarProps) {
  const { t } = useTranslation('todoComment');
  const fontScaledSize = useFontScaledSize();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentLabel = match(value)
    .with(TODO_COMMENT_SORT.POPULAR, () => t('sort.popular'))
    .with(TODO_COMMENT_SORT.LATEST, () => t('sort.latest'))
    .exhaustive();

  return (
    <Menu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          className="min-h-11 flex-row items-center gap-1 ps-3"
          isDisabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('sort.label', { value: currentLabel })}
          accessibilityState={{ expanded: isMenuOpen, busy: isLoading, disabled: isLoading }}
        >
          <Text size="b4" shade={6}>
            {currentLabel}
          </Text>
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            <HStack className="rotate-90">
              <ArrowRightIcon
                width={fontScaledSize(13)}
                height={fontScaledSize(13)}
                colorClassName="text-gray-6"
              />
            </HStack>
          )}
        </PressableFeedback>
      </Menu.Trigger>
      <MenuContent width={SORT_MENU_WIDTH}>
        <Menu.Group
          selectionMode="single"
          selectedKeys={new Set([value])}
          onSelectionChange={(selectedKeys) => {
            const [selected] = selectedKeys;
            const next = toSort(selected);
            if (next != null && next !== value) {
              onChange(next);
            }
          }}
          shouldCloseOnSelect
        >
          <Menu.Item id={TODO_COMMENT_SORT.LATEST}>
            <Menu.ItemIndicator />
            <Menu.ItemTitle>
              <Text size="b2" weight="medium" className="text-foreground">
                {t('sort.latest')}
              </Text>
            </Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item id={TODO_COMMENT_SORT.POPULAR}>
            <Menu.ItemIndicator />
            <Menu.ItemTitle>
              <Text size="b2" weight="medium" className="text-foreground">
                {t('sort.popular')}
              </Text>
            </Menu.ItemTitle>
          </Menu.Item>
        </Menu.Group>
      </MenuContent>
    </Menu>
  );
};

interface TodoCommentThreadListItemProps {
  thread: TodoCommentThread;
  anchor: TodoCommentThreadAnchor | null;
}

/** 한 묶음: 댓글과 그 답글. 목록이 행을 재활용해도 메뉴·좋아요 상태가 다른 댓글로 넘어가지 않게 댓글마다 key로 새로 만든다. 연결선은 댓글 아바타 아래에서 마지막 답글(또는 더 보기)까지 이어진다 */
TodoCommentThreadList.Item = function Item({ thread, anchor }: TodoCommentThreadListItemProps) {
  const hasReplies = TodoCommentThreadPolicy.hasRepliesToShow(thread);

  return (
    <VStack pb={8} testID={`todo-comment-thread-${thread.comment.id}`}>
      <TodoCommentItem key={thread.comment.id} comment={thread.comment} hasReplies={hasReplies} />
      {hasReplies && (
        <TodoCommentThreadList.Replies key={thread.comment.id} thread={thread} anchor={anchor} />
      )}
    </VStack>
  );
};

/** 펼치면 그 자리에서 답글 페이지를 이어 붙여 위 행은 움직이지 않고 아래로만 늘어난다 */
TodoCommentThreadList.Replies = function Replies({
  thread,
  anchor,
}: TodoCommentThreadListItemProps) {
  const { t } = useTranslation('todoComment');
  const { resolvedLanguage } = useLanguage();
  const { todoId } = thread.comment;
  const { trackEvent } = useTrack();
  const anchoredReplyId = TodoCommentThreadPolicy.findAnchoredReplyId(thread, anchor);
  // 알림으로 연 답글은 사용자가 보려고 고른 것이라 직접 펼친 것으로 본다
  const [expansion, setExpansion] = useThreadExpansion(thread.comment.id, {
    isExpanded: anchoredReplyId != null,
    source: 'user',
  });
  const queryClient = useQueryClient();
  const repliesOptions = useGetTodoCommentRepliesInfiniteQueryOptions({
    todoId,
    commentId: thread.comment.id,
    aroundReplyId: anchoredReplyId,
    isEnabled: expansion.isExpanded,
  });
  const repliesQuery = useInfiniteQuery(repliesOptions);
  const replies = repliesQuery.data;

  const formatCount = (count: number) => ({
    count,
    formatted: formatCompactCount(count, resolvedLanguage),
  });
  // 펼친 뒤 실제로 불러온 답글 수를 페이지가 도착한 다음에 보낸다
  const trackLoadedCount = (loadedCount: number) =>
    trackEvent('todo_comment_replies_expanded', { todo_id: todoId, loaded_count: loadedCount });

  if (!expansion.isExpanded) {
    const preview = thread.previewReply;
    const hiddenCount = TodoCommentThreadPolicy.getCollapsedHiddenReplyCount(thread);

    return (
      <VStack>
        {preview != null && (
          <TodoCommentItem key={preview.id} comment={preview} isLast={hiddenCount === 0} />
        )}
        {hiddenCount > 0 && (
          <TodoCommentItem.More
            isReply
            label={t(
              preview == null ? 'replies.view' : 'replies.viewMore',
              formatCount(hiddenCount),
            )}
            onPress={() => {
              setExpansion({ isExpanded: true, source: 'user' });
              ensureTodoCommentReplies(queryClient, repliesOptions)
                .then((loadedReplies) => trackLoadedCount(loadedReplies.length))
                // 실패는 조회 캐시가 보고하고 답글 줄이 다시 시도 줄로 바뀐다
                .catch(noop);
            }}
          />
        )}
      </VStack>
    );
  }

  if (replies == null) {
    return repliesQuery.isError ? (
      <TodoCommentItem.More
        isReply
        label={t('replies.retry')}
        onPress={() => {
          // 실패는 조회 캐시가 보고하고 다시 시도 줄이 그대로 남는다
          repliesQuery.refetch().catch(noop);
        }}
      />
    ) : (
      <TodoCommentItem.Loading isReply />
    );
  }

  const { hasNextPage, hasPreviousPage, isFetchingNextPage } = repliesQuery;
  const viewMoreLabel = t(
    'replies.viewMore',
    formatCount(TodoCommentThreadPolicy.getHiddenReplyCount(thread, replies.length)),
  );
  const footer = getReplyFooter(thread, { loadedCount: replies.length, hasNextPage, expansion });
  const lastReplyId = footer === 'none' && !isFetchingNextPage ? replies.at(-1)?.id : null;

  return (
    <VStack>
      {hasPreviousPage && (
        <TodoCommentItem.More
          isReply
          isConnectedBelow
          label={viewMoreLabel}
          onPress={() => {
            // 실패는 조회 캐시가 보고하고 버튼이 그대로 남아 다시 누를 수 있다
            repliesQuery.fetchPreviousPage().catch(noop);
          }}
        />
      )}
      {replies.map((reply) => (
        <TodoCommentItem key={reply.id} comment={reply} isLast={reply.id === lastReplyId} />
      ))}
      {isFetchingNextPage ? (
        <TodoCommentItem.Loading isReply />
      ) : (
        match(footer)
          .with('viewMore', () => (
            <TodoCommentItem.More
              isReply
              label={viewMoreLabel}
              onPress={() => {
                repliesQuery
                  .fetchNextPage()
                  .then((result) => trackLoadedCount(result.data?.length ?? replies.length))
                  // 실패는 조회 캐시가 보고하고 버튼이 그대로 남아 다시 누를 수 있다
                  .catch(noop);
              }}
            />
          ))
          .with('hide', () => (
            <TodoCommentItem.More
              isReply
              label={t('replies.hide')}
              onPress={() => setExpansion({ isExpanded: false, source: 'user' })}
            />
          ))
          .with('none', () => null)
          .exhaustive()
      )}
    </VStack>
  );
};

TodoCommentThreadList.Loading = function Loading() {
  return (
    <KeyboardScrollView style={styles.fallbackScrollView} showsVerticalScrollIndicator={false}>
      {/* oxlint-disable-next-line aido/spacing-scale -- 할 일 상세 머리 세로 여백. 규격 단계 사이 18px을 쓴다 */}
      <Box px={16} py={18}>
        <TodoDetailSummary.Loading />
      </Box>
      <Separator />
      <TodoCommentThreadList.Toolbar />
      <VStack testID="todo-comment-thread-list-loading">
        {range(LOADING_ROW_COUNT).map((index) => (
          <TodoCommentItem.Loading key={index} />
        ))}
      </VStack>
    </KeyboardScrollView>
  );
};

TodoCommentThreadList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoComment');

  return (
    <KeyboardScrollView style={styles.fallbackScrollView} showsVerticalScrollIndicator={false}>
      <TodoCommentThreadList.Header />
      <HStack flex={1} justify="center" align="center" py={32}>
        <QueryErrorFallback title={t('list.loadFailed')} reset={reset} />
      </HStack>
    </KeyboardScrollView>
  );
};

TodoCommentThreadList.Empty = function Empty() {
  const { t } = useTranslation('todoComment');

  return (
    <Box px={16} py={24}>
      <Result icon={<CommentIllustration size="block" />} title={t('list.emptyDescription')} />
    </Box>
  );
};

function CommentCount() {
  const { t } = useTranslation('todoComment');
  const [todoId] = useTodoId();
  const { resolvedLanguage } = useLanguage();
  const { data: detail, isPending } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return (
    <HStack gap={4} align="center" className="shrink">
      <Text size="b3" weight="semibold">
        {t('list.heading')}
      </Text>
      {isPending && <TextSkeleton size="b3" className="w-4" />}
      {detail != null && (
        <Text size="b3" weight="semibold" testID="todo-comment-count">
          {formatCompactCount(detail.metrics.commentCount, resolvedLanguage)}
        </Text>
      )}
    </HStack>
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
  const fontScaledSize = useFontScaledSize();
  const isAnimating = useIsAnimationActive();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  useEffect(() => {
    if (!isAnimating) {
      scale.set(1);
      return;
    }
    scale.set(
      withRepeat(
        withSequence(
          withDelay(HINT_PULSE.delayMs, withSpring(HINT_PULSE.peakScale)),
          withSpring(1),
        ),
        -1,
      ),
    );

    return () => cancelAnimation(scale);
  }, [isAnimating, scale]);

  return (
    <Animated.View style={style}>
      <HeartFilledIcon
        width={fontScaledSize(HINT_HEART_SIZE)}
        height={fontScaledSize(HINT_HEART_SIZE)}
        colorClassName="text-error"
      />
    </Animated.View>
  );
}

interface KeyboardScrollViewProps extends Omit<
  ComponentProps<typeof KeyboardChatScrollView>,
  | 'ref'
  | 'automaticallyAdjustContentInsets'
  | 'contentInsetAdjustmentBehavior'
  | 'keyboardDismissMode'
  | 'keyboardShouldPersistTaps'
  | 'freeze'
  | 'extraContentPadding'
  | 'blankSpace'
> {
  ref?: Ref<Reanimated.ScrollView>;
}

/** 목록과 받기 전·실패 화면이 함께 쓰는 스크롤. 키보드를 따라 올라가고 작성기가 커진 만큼 끝을 더 올린다 */
function KeyboardScrollView({
  keyboardLiftBehavior = 'whenAtEnd',
  onLayout,
  onContentSizeChange,
  ...props
}: KeyboardScrollViewProps) {
  const keyboardBottomGap = useKeyboardBottomGap();
  const { hasKeyboardInsetAnimation } = useDeviceTraits();
  const { extraContentPadding } = useTodoCommentReveal();
  // 대화를 push한 동안 아래에 남은 개요가 위 화면의 키보드에 반응하면 돌아왔을 때 스크롤 위치가 밀린다.
  const isScreenFocused = useIsFocused();
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  // 내용이 짧으면 아래 빈자리가 키보드를 받아 내, 첫 댓글을 쓸 때 할 일이 화면 밖으로 밀리지 않는다.
  const blankSpace = useDerivedValue(() => Math.max(0, viewportHeight.get() - contentHeight.get()));

  return (
    <KeyboardChatScrollView
      {...props}
      onLayout={(event) => {
        viewportHeight.set(event.nativeEvent.layout.height);
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        contentHeight.set(height);
        onContentSizeChange?.(width, height);
      }}
      blankSpace={blankSpace}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={getKeyboardDismissMode(hasKeyboardInsetAnimation)}
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
      offset={keyboardBottomGap}
      extraContentPadding={extraContentPadding}
      freeze={!isScreenFocused}
    />
  );
}

/** 새 정렬의 첫 페이지를 먼저 받아 두고 바꿔 목록이 skeleton으로 깜박이지 않게 한다 */
function useSortChange() {
  const [todoId] = useTodoId();
  // useIsFetching은 지금 정렬 목록의 배경 재조회에도 켜져 정렬 버튼이 꺼진다. 고른 정렬을 받는 동안만 켠다
  const prefetch = useMutation(usePrefetchTodoCommentThreadsMutationOptions({ todoId }));

  // mutate의 onSettled는 화면이 내려간 뒤에는 불리지 않는다
  const prefetchThenCommit = (sort: TodoCommentSort, commit: () => void) =>
    prefetch.mutate(sort, {
      onSettled: commit,
    });

  return { isPending: prefetch.isPending, prefetchThenCommit };
}

/** 다시 마운트하지 않아 FlashList가 첫 행 자리를 지키려 스크롤을 옮기므로 그 보정이 끝난 같은 커밋에서 맨 위로 올린다 */
function useScrollToTopOnSortChange(sort: TodoCommentSort) {
  const { listRef } = useTodoCommentReveal();
  const shownSortRef = useRef(sort);

  useLayoutEffect(() => {
    if (shownSortRef.current === sort) {
      return;
    }
    shownSortRef.current = sort;
    listRef.current?.scrollToTop({ animated: false });
  }, [listRef, sort]);
}

/** 알림으로 연 묶음으로 한 번만 옮기고 그 글을 잠깐 강조한다. 그 글이 사라졌으면 알리고 목록 맨 위를 보인다 */
function useScrollToAnchor({
  threads,
  anchor,
}: {
  threads: readonly TodoCommentThread[];
  anchor: TodoCommentThreadAnchor | null;
}) {
  const [{ comment }] = useTodoCommentParams();
  const { listRef, highlight, clearHighlight } = useTodoCommentReveal();
  const toast = useAppToast();
  const { t } = useTranslation('todoComment');
  const handledCommentRef = useRef<string | null>(null);

  useEffect(() => {
    if (comment == null || handledCommentRef.current === comment) {
      return;
    }
    handledCommentRef.current = comment;

    if (anchor == null) {
      // 앞서 연 위치의 강조가 남아 있으면 남은 시간을 기다리지 않고 끈다
      clearHighlight();
      toast.warning(t('toasts.anchorMissing'));

      return;
    }

    highlight(anchor.replyId ?? anchor.threadCommentId);
    const index = threads.findIndex((thread) => thread.comment.id === anchor.threadCommentId);
    if (index >= 0) {
      listRef.current
        ?.scrollToIndex({ index, viewPosition: ANCHOR_VIEW_POSITION, animated: true })
        // 스크롤하지 못해도 강조는 이미 켰다
        .catch(noop);
    }
  }, [anchor, clearHighlight, comment, highlight, listRef, t, threads, toast]);
}

function getThreadKey(thread: TodoCommentThread) {
  return thread.comment.id;
}

function renderThreadListScrollView(props: ScrollViewProps) {
  return <KeyboardScrollView {...props} />;
}

/** iOS는 목록을 끄는 손가락을 키보드가 따라 내려간다. Android는 제스처 영역이 맡고, 인셋 애니메이션이 없는 기기는 끌기 시작하면 닫는다 */
function getKeyboardDismissMode(
  hasKeyboardInsetAnimation: boolean,
): 'interactive' | 'on-drag' | 'none' {
  if (process.env.EXPO_OS === 'ios') {
    return 'interactive';
  }

  return hasKeyboardInsetAnimation ? 'none' : 'on-drag';
}

function toSort(key: MenuKey | undefined): TodoCommentSort | null {
  return match(key)
    .with(TODO_COMMENT_SORT.POPULAR, () => TODO_COMMENT_SORT.POPULAR)
    .with(TODO_COMMENT_SORT.LATEST, () => TODO_COMMENT_SORT.LATEST)
    .otherwise(() => null);
}

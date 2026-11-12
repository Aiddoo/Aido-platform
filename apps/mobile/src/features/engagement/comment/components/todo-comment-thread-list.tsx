import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api/vocabulary';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
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
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { formatCompactCount } from '@src/shared/utils/number-format';
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import { noop, range } from 'es-toolkit';
import { useNavigation } from 'expo-router';
import { Menu, type MenuKey, PressableFeedback, Separator, Spinner } from 'heroui-native';
import { type ComponentProps, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { match } from 'ts-pattern';

import { TODO_COMMENT_HIGHLIGHT_DURATION_MS } from '../constants/todo-comment.constants';
import {
  TodoCommentPolicy,
  type TodoCommentThread,
  type TodoCommentThreadAnchor,
} from '../domains/todo-comment.model';
import { useTodoCommentParams, useTodoCommentSort } from '../hooks/use-todo-comment-params';
import { invalidateTodoComments } from '../queries/todo-comment-cache';
import { usePrefetchTodoCommentThreadsMutationOptions } from '../queries/todo-comment.mutations';
import { useGetTodoCommentThreadsInfiniteQueryOptions } from '../queries/todo-comment.queries';
import { TodoCommentItem } from './todo-comment-item';
import { TodoCommentKeyboardScrollView } from './todo-comment-keyboard-scroll-view';
import { TodoCommentReplies } from './todo-comment-replies';
import { useTodoCommentReveal } from './todo-comment-reveal';
import { TodoCommentRailRow } from './todo-comment-thread-rail';
import { TodoDetailSummary } from './todo-detail-summary';

const SORT_MENU_WIDTH = 208;
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
          <TodoCommentThreadList.Header />
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

/** 할 일 본문과 댓글 수·정렬. 댓글과 함께 스크롤된다 */
TodoCommentThreadList.Header = function Header() {
  const [todoId] = useTodoId();
  const [sort, setSort] = useTodoCommentSort();
  const { trackEvent } = useTrack();
  const sortChange = useSortChange();

  return (
    <>
      <QueryErrorBoundary resetKeys={[todoId]}>
        <Suspense
          fallback={
            // oxlint-disable-next-line aido/spacing-scale -- 할 일 상세 머리 세로 여백. 규격 단계 사이 18px을 쓴다
            <Box px={16} py={18}>
              <TodoDetailSummary.Loading />
            </Box>
          }
        >
          {/* oxlint-disable-next-line aido/spacing-scale -- 할 일 상세 머리 세로 여백. 규격 단계 사이 18px을 쓴다 */}
          <Box px={16} py={18}>
            <TodoDetailSummary />
          </Box>
        </Suspense>
      </QueryErrorBoundary>

      <Separator />

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
    </>
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

TodoCommentThreadList.Loading = function Loading() {
  return (
    <TodoCommentKeyboardScrollView
      style={styles.fallbackScrollView}
      showsVerticalScrollIndicator={false}
    >
      <TodoCommentThreadList.Header />
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

TodoCommentThreadList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoComment');

  return (
    <TodoCommentKeyboardScrollView
      style={styles.fallbackScrollView}
      showsVerticalScrollIndicator={false}
    >
      <TodoCommentThreadList.Header />
      <HStack flex={1} justify="center" align="center" py={32}>
        <QueryErrorFallback title={t('list.loadFailed')} reset={reset} />
      </HStack>
    </TodoCommentKeyboardScrollView>
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

/** 새 정렬의 첫 페이지를 먼저 받아 두고 바꿔 목록이 skeleton으로 깜박이지 않게 한다 */
function useSortChange() {
  const [todoId] = useTodoId();
  const navigation = useNavigation();
  // useIsFetching은 지금 정렬 목록의 배경 재조회에도 켜져 정렬 버튼이 꺼진다. 고른 정렬을 받는 동안만 켠다
  const prefetch = useMutation(usePrefetchTodoCommentThreadsMutationOptions({ todoId }));

  // mutate의 onSettled는 화면이 내려간 뒤에는 불리지 않는다
  const prefetchThenCommit = (sort: TodoCommentSort, commit: () => void) =>
    prefetch.mutate(sort, {
      onSettled: () => {
        // router.setParams는 지금 보이는 화면에 걸린다. 받는 동안 떠났으면 그 화면의 params를 바꾸지 않는다
        if (navigation.isFocused()) {
          commit();
        }
      },
    });

  return { isPending: prefetch.isPending, prefetchThenCommit };
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

    // oxlint-disable-next-line react/set-state-in-effect -- URL로 들어온 댓글을 처음 맞을 때 한 번만 강조를 켠다
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

function toSort(key: MenuKey | undefined): TodoCommentSort | null {
  return match(key)
    .with(TODO_COMMENT_SORT.POPULAR, () => TODO_COMMENT_SORT.POPULAR)
    .with(TODO_COMMENT_SORT.LATEST, () => TODO_COMMENT_SORT.LATEST)
    .otherwise(() => null);
}

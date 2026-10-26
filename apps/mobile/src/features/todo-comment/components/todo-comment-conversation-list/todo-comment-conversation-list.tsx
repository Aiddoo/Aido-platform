import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { invalidateTodoDetails } from '@src/features/todo/queries/todo-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ChatBubbleIcon,
  HStack,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton, Spinner } from 'heroui-native';
import {
  type ComponentProps,
  createContext,
  createElement,
  isValidElement,
  type ReactNode,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  type ColorValue,
  RefreshControl,
  type ScrollViewProps,
  StyleSheet,
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import type {
  TodoComment,
  TodoCommentAuthor,
  TodoConversationConnection,
} from '../../domains/todo-comment.model';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { useGetTodoCommentConversationQueryOptions } from '../../queries/get-todo-comment-conversation-query-options';
import { invalidateTodoCommentConversations } from '../../queries/todo-comment-cache';
import {
  canFetchPreviousComments,
  FOCUSED_COMMENT_CLEARANCE,
  getCommentFocusRevealOffset,
  getConversationThreadId,
  getFocusedCommentKeyboardLiftBehavior,
  getInitialCommentIndex,
  getUnloadedCommentFocusOffset,
  type CommentKeyboardLiftBehavior,
} from '../../utils/comment-conversation-position';
import {
  getTodoCommentConnectionLayout,
  TODO_COMMENT_CONNECTION_GEOMETRY,
  type TodoCommentVerticalLaneLayout,
} from '../../utils/todo-comment-connection-layout';
import type {
  TodoCommentConversationFocusContext,
  TodoCommentConversationRowViewModel,
  TodoCommentConversationViewModel,
} from '../../utils/view-models/todo-comment-conversation.view-model';
import {
  TODO_COMMENT_AUTHOR_AVATAR_SIZE,
  type TodoCommentAuthorAvatarSize,
  TodoCommentAuthorAvatar,
} from '../todo-comment-author-avatar';
import { TodoCommentKeyboardScrollView } from '../todo-comment-keyboard-scroll-view';
import { TodoCommentMessage } from '../todo-comment-message';

const maintainVisibleContentPosition = { disabled: false } as const;
// 첫 위치부터 focus 위 여백을 둬 mount 직후 reveal 보정이 목록을 한 번 더 움직이지 않게 한다.
const initialScrollIndexParams = { viewOffset: -FOCUSED_COMMENT_CLEARANCE } as const;
const keyExtractor = (row: TodoCommentConversationRowViewModel) => row.comment.id;
const renderRow = ({ item }: { item: TodoCommentConversationRowViewModel }) => (
  <ConversationRow row={item} />
);

type ConversationFlashListProps = ComponentProps<
  typeof FlashList<TodoCommentConversationRowViewModel>
>;

interface TodoCommentConversationListProps extends Omit<
  ConversationFlashListProps,
  | 'ref'
  | 'data'
  | 'keyExtractor'
  | 'renderItem'
  | 'renderScrollComponent'
  | 'refreshControl'
  | 'refreshing'
  | 'onRefresh'
  | 'progressViewOffset'
  | 'onStartReached'
  | 'onEndReached'
  | 'maintainVisibleContentPosition'
  | 'onStartReachedThreshold'
  | 'onEndReachedThreshold'
  | 'showsVerticalScrollIndicator'
  | 'ListFooterComponent'
  | 'ListEmptyComponent'
  | 'onLoad'
  | 'initialScrollIndex'
  | 'initialScrollIndexParams'
> {
  extraContentPadding: SharedValue<number>;
}

interface ConversationPaginationState {
  isFetchingPreviousPage: boolean;
  isFetchingNextPage: boolean;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  fetchPreviousPage: () => Promise<unknown>;
  fetchNextPage: () => Promise<unknown>;
}

interface TodoCommentConversationWindowProps extends TodoCommentConversationListProps {
  conversation: TodoCommentConversationViewModel;
  pagination: ConversationPaginationState;
  isRefreshing: boolean;
  onRefresh: () => void;
  refreshTint: ColorValue | undefined;
}

interface FocusKeyboardLiftPolicy {
  focusCommentId: string;
  interactionMode: TodoCommentInteractionMode;
  behavior: CommentKeyboardLiftBehavior;
}

interface FocusViewportIdentity {
  focusCommentId: string;
  interactionMode: TodoCommentInteractionMode;
}

type TodoCommentInteractionMode = 'reading' | 'reply' | 'edit';

interface ConversationKeyboardScrollContextValue {
  extraContentPadding: SharedValue<number>;
  keyboardLiftBehavior: CommentKeyboardLiftBehavior;
}

const ConversationKeyboardScrollContext =
  createContext<ConversationKeyboardScrollContextValue | null>(null);

function useConversationKeyboardScrollContext(): ConversationKeyboardScrollContextValue {
  const context = useContext(ConversationKeyboardScrollContext);
  if (context == null) {
    throw new Error('댓글 대화 keyboard scroll은 댓글 목록 안에서 사용해 주세요.');
  }
  return context;
}

function ConversationKeyboardScrollView(props: ScrollViewProps) {
  const { extraContentPadding, keyboardLiftBehavior } = useConversationKeyboardScrollContext();

  return (
    <TodoCommentKeyboardScrollView
      {...props}
      extraContentPadding={extraContentPadding}
      keyboardLiftBehavior={keyboardLiftBehavior}
    />
  );
}

const renderConversationKeyboardScrollView = (props: ScrollViewProps) => (
  <ConversationKeyboardScrollView {...props} />
);

function toListHeaderElement(header: ConversationFlashListProps['ListHeaderComponent']): ReactNode {
  if (header == null) {
    return null;
  }
  return isValidElement(header) ? header : createElement(header);
}

function isSameFocusViewport(
  left: FocusViewportIdentity | null,
  right: FocusViewportIdentity | null,
): boolean {
  return (
    left?.focusCommentId === right?.focusCommentId &&
    left?.interactionMode === right?.interactionMode
  );
}

function getInteractionMode(
  commentRoute: ReturnType<typeof useTodoCommentRoute>[0],
): TodoCommentInteractionMode {
  return commentRoute.view === 'conversation' ? (commentRoute.form?.type ?? 'reading') : 'reading';
}

interface FocusedCommentViewportOptions {
  rows: TodoCommentConversationRowViewModel[];
  focusCommentId: string | null;
  interactionMode: TodoCommentInteractionMode;
  onViewableItemsChanged: ConversationFlashListProps['onViewableItemsChanged'];
  onCommitLayoutEffect: ConversationFlashListProps['onCommitLayoutEffect'];
}

function useFocusedCommentViewport({
  rows,
  focusCommentId,
  interactionMode,
  onViewableItemsChanged,
  onCommitLayoutEffect,
}: FocusedCommentViewportOptions) {
  const { t } = useTranslation('todoComment');
  const prefersReducedMotion = useReducedMotion();
  const listRef = useRef<FlashListRef<TodoCommentConversationRowViewModel>>(null);
  const hasLoadedRef = useRef(false);
  const announcedFocusCommentIdRef = useRef<string | null>(null);
  const visibleCommentIdsRef = useRef<Set<string>>(new Set());
  const adjustedFocusViewportRef = useRef<FocusViewportIdentity | null>(null);
  const keyboardState = useKeyboardState((state) => ({
    height: state.height,
    isVisible: state.isVisible,
  }));
  const wasKeyboardVisibleRef = useRef(keyboardState.isVisible);
  const [keyboardLiftPolicy, setKeyboardLiftPolicy] = useState<FocusKeyboardLiftPolicy | null>(
    null,
  );
  const focusViewport = useMemo(
    () => (focusCommentId == null ? null : { focusCommentId, interactionMode }),
    [focusCommentId, interactionMode],
  );
  const hasKeyboardLiftPolicyForFocus =
    keyboardLiftPolicy != null && isSameFocusViewport(keyboardLiftPolicy, focusViewport);
  const keyboardLiftBehavior =
    keyboardLiftPolicy != null && hasKeyboardLiftPolicyForFocus
      ? keyboardLiftPolicy.behavior
      : 'whenAtEnd';
  const initialScrollIndex = getInitialCommentIndex(rows, focusCommentId);

  useLayoutEffect(() => {
    const wasKeyboardVisible = wasKeyboardVisibleRef.current;
    wasKeyboardVisibleRef.current = keyboardState.isVisible;

    if (wasKeyboardVisible === keyboardState.isVisible) {
      return;
    }

    adjustedFocusViewportRef.current = null;
    if (!wasKeyboardVisible || keyboardState.isVisible || focusViewport == null) {
      return;
    }

    setKeyboardLiftPolicy((currentPolicy) => {
      if (
        currentPolicy == null ||
        !isSameFocusViewport(currentPolicy, focusViewport) ||
        currentPolicy.behavior !== 'persistent'
      ) {
        return currentPolicy;
      }

      return { ...focusViewport, behavior: 'never' };
    });
  }, [focusViewport, keyboardState.isVisible]);

  const announceFocusedComment = useCallback(() => {
    AccessibilityInfo.announceForAccessibilityWithOptions(t('list.focusedAnnouncement'), {
      queue: true,
      priority: 'low',
    });
  }, [t]);

  const markFocusAsAnnounced = useCallback(
    (commentId: string) => {
      announcedFocusCommentIdRef.current = commentId;
      announceFocusedComment();
    },
    [announceFocusedComment],
  );

  const handleListLoad = useCallback(() => {
    hasLoadedRef.current = true;

    if (focusCommentId == null || announcedFocusCommentIdRef.current === focusCommentId) {
      return;
    }

    markFocusAsAnnounced(focusCommentId);
  }, [focusCommentId, markFocusAsAnnounced]);

  const handleViewableItemsChanged = useCallback<
    NonNullable<ConversationFlashListProps['onViewableItemsChanged']>
  >(
    (info) => {
      visibleCommentIdsRef.current = new Set(
        info.viewableItems.filter((item) => item.isViewable).map((item) => item.item.comment.id),
      );
      onViewableItemsChanged?.(info);
    },
    [onViewableItemsChanged],
  );

  const handleCommitLayout = useCallback(() => {
    const list = listRef.current;
    const focusIndex = getInitialCommentIndex(rows, focusCommentId);

    if (focusCommentId != null && focusViewport != null && list != null && focusIndex != null) {
      const itemLayout = list.getLayout(focusIndex);
      if (itemLayout != null) {
        const firstItemOffset = list.getFirstItemOffset();
        const scrollOffset = list.getAbsoluteLastScrollOffset();
        const viewportHeight = list.getWindowSize().height;
        if (!hasKeyboardLiftPolicyForFocus) {
          setKeyboardLiftPolicy({
            ...focusViewport,
            behavior: getFocusedCommentKeyboardLiftBehavior({
              itemLayout,
              firstItemOffset,
              scrollOffset,
              viewportHeight,
            }),
          });
        }

        if (
          (!keyboardState.isVisible || keyboardState.height > 0) &&
          !isSameFocusViewport(adjustedFocusViewportRef.current, focusViewport)
        ) {
          adjustedFocusViewportRef.current = focusViewport;
          const focusRevealOffset = getCommentFocusRevealOffset({
            itemLayout,
            firstItemOffset,
            scrollOffset,
            viewportHeight,
            bottomInset: keyboardState.isVisible ? keyboardState.height : 0,
          });

          if (focusRevealOffset != null) {
            const shouldAnimate =
              hasLoadedRef.current &&
              announcedFocusCommentIdRef.current !== focusCommentId &&
              visibleCommentIdsRef.current.has(focusCommentId) &&
              !prefersReducedMotion;
            markFocusAsAnnounced(focusCommentId);
            list.scrollToOffset({
              offset: focusRevealOffset,
              animated: shouldAnimate,
              skipFirstItemOffset: true,
            });
            onCommitLayoutEffect?.();
            return;
          }
        }
      }
    }

    if (!hasLoadedRef.current) {
      onCommitLayoutEffect?.();
      return;
    }

    if (focusCommentId == null || announcedFocusCommentIdRef.current === focusCommentId) {
      onCommitLayoutEffect?.();
      return;
    }

    if (visibleCommentIdsRef.current.has(focusCommentId)) {
      markFocusAsAnnounced(focusCommentId);
      onCommitLayoutEffect?.();
      return;
    }

    if (list == null || focusIndex == null) {
      onCommitLayoutEffect?.();
      return;
    }

    const itemLayout = list.getLayout(focusIndex);
    if (itemLayout == null) {
      onCommitLayoutEffect?.();
      return;
    }

    const offset = getUnloadedCommentFocusOffset({
      itemLayout,
      firstItemOffset: list.getFirstItemOffset(),
      viewportHeight: list.getWindowSize().height,
    });
    markFocusAsAnnounced(focusCommentId);
    list.scrollToOffset({ offset, animated: false, skipFirstItemOffset: true });
    onCommitLayoutEffect?.();
  }, [
    focusCommentId,
    focusViewport,
    hasKeyboardLiftPolicyForFocus,
    keyboardState.height,
    keyboardState.isVisible,
    markFocusAsAnnounced,
    onCommitLayoutEffect,
    prefersReducedMotion,
    rows,
  ]);

  const shouldLoadPreviousComments = useCallback(
    () => canFetchPreviousComments(focusCommentId, announcedFocusCommentIdRef.current),
    [focusCommentId],
  );

  return {
    listRef,
    keyboardLiftBehavior,
    initialScrollIndex,
    handleListLoad,
    handleViewableItemsChanged,
    handleCommitLayout,
    shouldLoadPreviousComments,
  };
}

export function TodoCommentConversationList({
  extraContentPadding,
  ListHeaderComponent,
  ...flashListProps
}: TodoCommentConversationListProps) {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const focusCommentId = commentRoute.view === 'conversation' ? commentRoute.commentId : undefined;
  const queryClient = useQueryClient();
  const conversationQuery = useSuspenseInfiniteQuery(
    useGetTodoCommentConversationQueryOptions({
      todoId,
      sort: commentRoute.sort,
      focusCommentId,
    }),
  );
  const { color: refreshTint } = useResolveClassNames('text-main');
  const { rows, focus } = conversationQuery.data;
  const threadId = getConversationThreadId(rows, focus?.commentId ?? null);
  const listIdentity = `${todoId}:${commentRoute.sort}:${threadId ?? focusCommentId ?? 'empty'}`;

  const [isRefreshing, refresh] = useRefresh(
    useCallback(
      () =>
        Promise.all([
          invalidateTodoDetails(queryClient, { todoId }),
          invalidateTodoCommentConversations({ queryClient, todoId }),
        ]),
      [queryClient, todoId],
    ),
  );

  return (
    <TodoCommentConversationWindow
      {...flashListProps}
      key={listIdentity}
      extraContentPadding={extraContentPadding}
      ListHeaderComponent={ListHeaderComponent}
      conversation={{ rows, focus }}
      pagination={{
        isFetchingPreviousPage: conversationQuery.isFetchingPreviousPage,
        isFetchingNextPage: conversationQuery.isFetchingNextPage,
        hasPreviousPage: conversationQuery.hasPreviousPage,
        hasNextPage: conversationQuery.hasNextPage,
        fetchPreviousPage: () => conversationQuery.fetchPreviousPage({ cancelRefetch: false }),
        fetchNextPage: () => conversationQuery.fetchNextPage({ cancelRefetch: false }),
      }}
      isRefreshing={isRefreshing}
      onRefresh={refresh}
      refreshTint={refreshTint}
    />
  );
}

function TodoCommentConversationWindow({
  conversation,
  pagination,
  extraContentPadding,
  ListHeaderComponent,
  isRefreshing,
  onRefresh,
  refreshTint,
  onViewableItemsChanged,
  onCommitLayoutEffect,
  ...flashListProps
}: TodoCommentConversationWindowProps) {
  const { t } = useTranslation('todoComment');
  const [commentRoute] = useTodoCommentRoute();
  const { rows, focus } = conversation;
  const focusIdentity = focus == null ? null : focus.commentId;
  const {
    listRef,
    keyboardLiftBehavior,
    initialScrollIndex,
    handleListLoad,
    handleViewableItemsChanged,
    handleCommitLayout,
    shouldLoadPreviousComments,
  } = useFocusedCommentViewport({
    rows,
    focusCommentId: focusIdentity,
    interactionMode: getInteractionMode(commentRoute),
    onViewableItemsChanged,
    onCommitLayoutEffect,
  });
  const keyboardScrollContext = useMemo(
    () => ({ extraContentPadding, keyboardLiftBehavior }),
    [extraContentPadding, keyboardLiftBehavior],
  );
  const listHeaderElement = toListHeaderElement(ListHeaderComponent);

  return (
    <ConversationKeyboardScrollContext value={keyboardScrollContext}>
      <FlashList
        {...flashListProps}
        ref={listRef}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        renderScrollComponent={renderConversationKeyboardScrollView}
        initialScrollIndex={initialScrollIndex}
        initialScrollIndexParams={initialScrollIndexParams}
        onLoad={handleListLoad}
        onViewableItemsChanged={handleViewableItemsChanged}
        onCommitLayoutEffect={handleCommitLayout}
        ListHeaderComponent={
          <>
            {listHeaderElement}
            {pagination.isFetchingPreviousPage && (
              <Box py={8} className="items-center">
                <Spinner size="sm" accessibilityLabel={t('list.loadingEarlier')} />
              </Box>
            )}
          </>
        }
        ListEmptyComponent={TodoCommentConversationList.Empty}
        ListFooterComponent={
          pagination.isFetchingNextPage ? (
            <Box py={12} className="items-center">
              <Spinner size="sm" accessibilityLabel={t('list.loadingMore')} />
            </Box>
          ) : null
        }
        maintainVisibleContentPosition={maintainVisibleContentPosition}
        onStartReached={() => {
          if (!shouldLoadPreviousComments()) {
            return;
          }

          if (pagination.hasPreviousPage && !pagination.isFetchingPreviousPage) {
            pagination.fetchPreviousPage().catch(() => undefined);
          }
        }}
        onStartReachedThreshold={0.25}
        onEndReached={() => {
          if (pagination.hasNextPage && !pagination.isFetchingNextPage) {
            pagination.fetchNextPage().catch(() => undefined);
          }
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={refreshTint}
            colors={refreshTint == null ? undefined : [refreshTint]}
          />
        }
      />
    </ConversationKeyboardScrollContext>
  );
}

TodoCommentConversationList.Loading = function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <VStack>
      {times(rows, (index) => (
        <ConversationRowSkeleton key={index} />
      ))}
    </VStack>
  );
};

TodoCommentConversationList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todoComment', 'common']);
  return (
    <Result
      title={t('todoComment:list.loadFailed')}
      button={<QueryErrorActions onRetry={reset} />}
    />
  );
};

/**
 * focus 대화는 고른 댓글의 thread를 읽으므로 비어 있다면 그 댓글이 삭제됐거나 볼 수 없게 된 경우다.
 * 알림으로 들어온 사용자가 "첫 댓글을 남겨보세요"를 보지 않게 댓글 목록으로 돌아가는 길을 준다.
 */
TodoCommentConversationList.Empty = function Empty() {
  const { t } = useTranslation('todoComment');
  const [_commentRoute, updateCommentRoute] = useTodoCommentRoute();
  return (
    <Box py={48} testID="todo-comment-missing">
      <Result
        icon={<ChatBubbleIcon width={72} height={72} colorClassName="text-gray-4" />}
        title={t('list.missingTitle')}
        description={t('list.missingDescription')}
        button={
          <Result.Button onPress={updateCommentRoute.showOverview}>
            {t('list.showAllComments')}
          </Result.Button>
        }
      />
    </Box>
  );
};

const ROW_HORIZONTAL_PADDING = 16;
const MESSAGE_GAP = 12;

interface ConversationRowProps {
  row: TodoCommentConversationRowViewModel;
}

const ConversationRow = memo(function ConversationRow({ row }: ConversationRowProps) {
  return (
    <Box>
      {row.focusContext != null && <ConversationContextRow context={row.focusContext} />}

      <ConversationCommentRow
        comment={row.comment}
        connection={row.connection}
        isFocused={row.isFocused}
      />
    </Box>
  );
});

function ConversationContextRow({ context }: { context: TodoCommentConversationFocusContext }) {
  return (
    <HStack px={ROW_HORIZONTAL_PADDING} gap={MESSAGE_GAP} align="stretch">
      <ConversationThreadRail
        author={context.parent.author}
        avatarSize="sm"
        connection={context.connection}
      />
      <Box flex={1} py={TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding} className="min-w-0">
        <FocusedTodoCommentParentContext context={context} />
      </Box>
    </HStack>
  );
}

interface ConversationCommentRowProps {
  comment: TodoComment;
  connection: TodoConversationConnection;
  isFocused: boolean;
}

function ConversationCommentRow({ comment, connection, isFocused }: ConversationCommentRowProps) {
  return (
    <HStack
      px={ROW_HORIZONTAL_PADDING}
      gap={MESSAGE_GAP}
      align="stretch"
      accessibilityState={{ selected: isFocused }}
    >
      {isFocused && <FocusedCommentHighlight key={comment.id} />}
      <ConversationThreadRail author={comment.author} avatarSize="md" connection={connection} />
      <Box flex={1} py={TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding} className="min-w-0">
        <TodoCommentMessage comment={comment} isFocused={isFocused} />
      </Box>
    </HStack>
  );
}

const FOCUSED_COMMENT_HIGHLIGHT = { holdMs: 1200, fadeMs: 900 } as const;

/**
 * 알림이나 목록에서 고른 댓글을 잠깐 강조한 뒤 천천히 지운다. 행 높이와 배치에 관여하지 않는 overlay라
 * 사라져도 layout이 움직이지 않는다. 동작 줄이기에서는 깜빡이지 않고 강조를 그대로 둔다.
 */
function FocusedCommentHighlight() {
  const prefersReducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    opacity.value = withDelay(
      FOCUSED_COMMENT_HIGHLIGHT.holdMs,
      withTiming(0, { duration: FOCUSED_COMMENT_HIGHLIGHT.fadeMs }),
    );
  }, [opacity, prefersReducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="bg-main/10"
      style={[StyleSheet.absoluteFill, animatedStyle]}
    />
  );
}

interface ConversationThreadRailProps {
  author: TodoCommentAuthor | null;
  avatarSize: TodoCommentAuthorAvatarSize;
  connection: TodoConversationConnection;
}

function ConversationThreadRail({ author, avatarSize, connection }: ConversationThreadRailProps) {
  const avatarSizePx = TODO_COMMENT_AUTHOR_AVATAR_SIZE[avatarSize];
  const layout = getTodoCommentConnectionLayout(connection, avatarSizePx);

  return (
    <Box
      className="relative shrink-0 self-stretch"
      style={{ width: layout.railWidth, minHeight: layout.minimumHeight }}
    >
      {layout.upperLanes.map((lane) => (
        <ConversationVerticalLane key={`upper-${lane.x}`} layout={lane} />
      ))}
      {layout.lowerLanes.map((lane) => (
        <ConversationVerticalLane key={`lower-${lane.x}`} layout={lane} />
      ))}
      {layout.incomingBranch != null && (
        <Box
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute border-b-2 border-l-2 border-gray-4"
          style={{
            left: layout.incomingBranch.left - TODO_COMMENT_CONNECTION_GEOMETRY.railWidth / 2,
            top: layout.incomingBranch.top,
            width: layout.incomingBranch.width,
            height: layout.incomingBranch.height,
            borderBottomLeftRadius: layout.incomingBranch.radius,
          }}
        />
      )}

      <TodoCommentAuthorAvatar
        author={author}
        size={avatarSize}
        className="absolute border-2 border-background"
        style={{ left: layout.avatarLeft, top: layout.avatarTop }}
      />
    </Box>
  );
}

function ConversationVerticalLane({ layout }: { layout: TodoCommentVerticalLaneLayout }) {
  return (
    <Box
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute rounded-full bg-gray-4"
      style={{
        left: layout.x - TODO_COMMENT_CONNECTION_GEOMETRY.railWidth / 2,
        top: layout.top,
        bottom: layout.bottom,
        height: layout.height,
        width: TODO_COMMENT_CONNECTION_GEOMETRY.railWidth,
      }}
    />
  );
}

interface FocusedTodoCommentParentContextProps {
  context: TodoCommentConversationFocusContext;
}

function FocusedTodoCommentParentContext({ context }: FocusedTodoCommentParentContextProps) {
  const { t } = useTranslation('todoComment');
  const parentName = context.parent.author?.name ?? t('list.unknownUser');
  const parentContent = context.parent.content ?? t('list.deleted');

  return (
    <VStack gap={3} className="min-w-0">
      <Text size="e1" shade={6} weight="medium">
        {t('list.repliedTo', { name: parentName })}
      </Text>
      <Text size="b4" shade={8} maxLines={2} accessibilityLabel={parentContent}>
        {parentContent}
      </Text>
      {context.earlierAncestorCount > 0 && (
        <Text size="e1" shade={5}>
          {t('list.earlierContextCount', { count: context.earlierAncestorCount })}
        </Text>
      )}
    </VStack>
  );
}

function ConversationRowSkeleton() {
  return (
    <HStack px={ROW_HORIZONTAL_PADDING} gap={MESSAGE_GAP} align="start">
      <Box py={TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding}>
        <Skeleton className="size-9 rounded-full" />
      </Box>
      <Box flex={1} py={TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding} className="min-w-0">
        <TodoCommentMessage.Loading />
      </Box>
    </HStack>
  );
}

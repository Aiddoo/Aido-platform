import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { usePrefersReducedMotion } from '@src/shared/hooks/use-prefers-reduced-motion';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ChatBubbleIcon,
  HStack,
  Result,
  Text,
  VStack,
  type QueryErrorFallbackProps,
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
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import type {
  TodoComment,
  TodoCommentAuthor,
  TodoConversationConnection,
} from '../../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../../constants/todo-comment-query-keys.constant';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { useTodoCommentConversationQueryOptions } from '../../queries/use-todo-comment-conversation-query-options';
import {
  canFetchPreviousComments,
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
} from '../../view-models/todo-comment-conversation.view-model';
import {
  TODO_COMMENT_AUTHOR_AVATAR_SIZE,
  type TodoCommentAuthorAvatarSize,
  TodoCommentAuthorAvatar,
} from '../TodoCommentAuthorAvatar';
import { TodoCommentKeyboardScrollView } from '../TodoCommentKeyboardScrollView';
import { TodoCommentMessage } from '../TodoCommentMessage';

const maintainVisibleContentPosition = { disabled: false } as const;
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
  if (context === null) {
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
  const prefersReducedMotion = usePrefersReducedMotion();
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
    () => (focusCommentId === null ? null : { focusCommentId, interactionMode }),
    [focusCommentId, interactionMode],
  );
  const keyboardLiftBehavior =
    keyboardLiftPolicy?.focusCommentId === focusCommentId &&
    keyboardLiftPolicy.interactionMode === interactionMode
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
    if (!wasKeyboardVisible || keyboardState.isVisible || focusViewport === null) {
      return;
    }

    setKeyboardLiftPolicy((currentPolicy) => {
      if (
        currentPolicy?.focusCommentId !== focusViewport.focusCommentId ||
        currentPolicy.interactionMode !== focusViewport.interactionMode ||
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

    if (focusCommentId === null || announcedFocusCommentIdRef.current === focusCommentId) {
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

    if (
      focusCommentId !== null &&
      focusViewport !== null &&
      list !== null &&
      focusIndex !== undefined
    ) {
      const itemLayout = list.getLayout(focusIndex);
      if (itemLayout !== undefined) {
        const firstItemOffset = list.getFirstItemOffset();
        const scrollOffset = list.getAbsoluteLastScrollOffset();
        const viewportHeight = list.getWindowSize().height;
        if (
          keyboardLiftPolicy?.focusCommentId !== focusViewport.focusCommentId ||
          keyboardLiftPolicy.interactionMode !== focusViewport.interactionMode
        ) {
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

          if (focusRevealOffset !== null) {
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

    if (focusCommentId === null || announcedFocusCommentIdRef.current === focusCommentId) {
      onCommitLayoutEffect?.();
      return;
    }

    if (visibleCommentIdsRef.current.has(focusCommentId)) {
      markFocusAsAnnounced(focusCommentId);
      onCommitLayoutEffect?.();
      return;
    }

    if (list === null || focusIndex === undefined) {
      onCommitLayoutEffect?.();
      return;
    }

    const itemLayout = list.getLayout(focusIndex);
    if (itemLayout === undefined) {
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
    keyboardLiftPolicy?.focusCommentId,
    keyboardLiftPolicy?.interactionMode,
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
  const query = useSuspenseInfiniteQuery(
    useTodoCommentConversationQueryOptions({
      todoId,
      sort: commentRoute.sort,
      focusCommentId,
    }),
  );
  const { color: refreshTint } = useResolveClassNames('text-main');
  const rows = query.data?.rows ?? [];
  const focus = query.data?.focus ?? null;
  const threadId = getConversationThreadId(rows, focus?.commentId ?? null);
  const listIdentity = `${todoId}:${commentRoute.sort}:${threadId ?? focusCommentId ?? 'empty'}`;

  const [isRefreshing, refresh] = useRefresh(
    useCallback(
      () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details(todoId) }),
          queryClient.invalidateQueries({
            queryKey: TODO_COMMENT_QUERY_KEYS.conversations(todoId),
          }),
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
        isFetchingPreviousPage: query.isFetchingPreviousPage,
        isFetchingNextPage: query.isFetchingNextPage,
        hasPreviousPage: query.hasPreviousPage,
        hasNextPage: query.hasNextPage,
        fetchPreviousPage: () => query.fetchPreviousPage({ cancelRefetch: false }),
        fetchNextPage: () => query.fetchNextPage({ cancelRefetch: false }),
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
  const focusIdentity = focus === null ? null : focus.commentId;
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
    interactionMode:
      commentRoute.view === 'conversation' ? (commentRoute.form?.type ?? 'reading') : 'reading',
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
            colors={refreshTint === undefined ? undefined : [refreshTint]}
          />
        }
      />
    </ConversationKeyboardScrollContext>
  );
}

TodoCommentConversationList.Empty = function Empty() {
  const { t } = useTranslation('todoComment');
  return (
    <Box py={48}>
      <Result
        icon={<ChatBubbleIcon width={72} height={72} colorClassName="text-gray-4" />}
        title={t('list.emptyTitle')}
        description={t('list.emptyDescription')}
      />
    </Box>
  );
};

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
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
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
      {row.focusContext !== null && <ConversationContextRow context={row.focusContext} />}

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
      className={isFocused ? 'bg-main/10' : undefined}
      accessibilityState={{ selected: isFocused }}
    >
      <ConversationThreadRail author={comment.author} avatarSize="md" connection={connection} />
      <Box flex={1} py={TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding} className="min-w-0">
        <TodoCommentMessage comment={comment} isFocused={isFocused} />
      </Box>
    </HStack>
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
      {layout.incomingBranch !== null && (
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
    <HStack
      px={ROW_HORIZONTAL_PADDING}
      gap={MESSAGE_GAP}
      align="start"
      py={TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding}
    >
      <Skeleton className="size-9 rounded-full" />
      <VStack flex={1} gap={3}>
        <HStack align="center" justify="between" gap={8}>
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="size-6 rounded-full" />
        </HStack>
        <Skeleton className="h-5 w-4/5 rounded" />
        <HStack align="center" gap={12} className="min-h-11">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3.5 w-5 rounded" />
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3.5 w-5 rounded" />
        </HStack>
      </VStack>
    </HStack>
  );
}

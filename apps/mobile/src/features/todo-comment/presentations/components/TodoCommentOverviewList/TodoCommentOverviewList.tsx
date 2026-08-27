import { FlashList } from '@shopify/flash-list';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  ChatBubbleIcon,
  HStack,
  Result,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Spinner } from 'heroui-native';
import {
  type ComponentProps,
  createElement,
  isValidElement,
  type ReactElement,
  useCallback,
} from 'react';
import { RefreshControl, type ScrollViewProps } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import type {
  TodoComment,
  TodoCommentOverviewItem,
  TodoCommentReplySummary,
} from '../../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../../constants/todo-comment-query-keys.constant';
import { useCommentConversationNavigation } from '../../hooks/use-comment-conversation-navigation';
import { useCommentRouteState } from '../../hooks/use-comment-route-state';
import { useTodoCommentOverviewQueryOptions } from '../../queries/use-todo-comment-overview-query-options';
import { TodoCommentArticle } from '../TodoCommentArticle';
import {
  TODO_COMMENT_AUTHOR_AVATAR_SIZE,
  TodoCommentAuthorAvatar,
} from '../TodoCommentAuthorAvatar';
import { TodoCommentKeyboardScrollView } from '../TodoCommentKeyboardScrollView';

const keyExtractor = (item: TodoCommentOverviewItem) => item.comment.id;
const renderItem = ({ item }: { item: TodoCommentOverviewItem }) => (
  <TodoCommentOverviewRow item={item} />
);

type OverviewFlashListProps = ComponentProps<typeof FlashList<TodoCommentOverviewItem>>;

interface TodoCommentOverviewListProps extends Omit<
  OverviewFlashListProps,
  | 'data'
  | 'keyExtractor'
  | 'renderItem'
  | 'renderScrollComponent'
  | 'refreshControl'
  | 'refreshing'
  | 'onRefresh'
  | 'onEndReached'
  | 'onEndReachedThreshold'
  | 'showsVerticalScrollIndicator'
  | 'ListFooterComponent'
  | 'ListEmptyComponent'
> {
  extraContentPadding: SharedValue<number>;
}

function toListHeaderElement(
  header: OverviewFlashListProps['ListHeaderComponent'],
): ReactElement | null {
  if (header == null) {
    return null;
  }

  return isValidElement(header) ? header : createElement(header);
}

export function TodoCommentOverviewList({
  extraContentPadding,
  ListHeaderComponent,
  ...flashListProps
}: TodoCommentOverviewListProps) {
  const { todoId } = useTodoScreenParams();
  const { sort } = useCommentRouteState();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery(useTodoCommentOverviewQueryOptions({ todoId, sort }));
  const { color: refreshTint } = useResolveClassNames('text-main');
  const { t } = useTranslation('todoComment');
  const renderKeyboardScrollView = useCallback(
    (props: ScrollViewProps) => (
      <TodoCommentKeyboardScrollView {...props} extraContentPadding={extraContentPadding} />
    ),
    [extraContentPadding],
  );
  const [isRefreshing, refresh] = useRefresh(
    useCallback(
      () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details(todoId) }),
          queryClient.invalidateQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.overviews(todoId) }),
        ]),
      [queryClient, todoId],
    ),
  );

  if (query.isError && query.data === undefined) {
    throw query.error;
  }

  return (
    <FlashList
      {...flashListProps}
      key={`${todoId}:${sort}`}
      data={query.data?.items ?? []}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderScrollComponent={renderKeyboardScrollView}
      ListHeaderComponent={toListHeaderElement(ListHeaderComponent)}
      ListEmptyComponent={
        query.isPending ? TodoCommentOverviewList.Loading : TodoCommentOverviewList.Empty
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <Box py={12} className="items-center">
            <Spinner size="sm" accessibilityLabel={t('list.loadingMore')} />
          </Box>
        ) : null
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage({ cancelRefetch: false }).catch(() => undefined);
        }
      }}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor={refreshTint}
          colors={refreshTint === undefined ? undefined : [refreshTint]}
        />
      }
    />
  );
}

TodoCommentOverviewList.Empty = function Empty() {
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

TodoCommentOverviewList.Loading = function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <VStack>
      {times(rows, (index) => (
        <TodoCommentOverviewRow.Loading key={index} />
      ))}
    </VStack>
  );
};

TodoCommentOverviewList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todoComment', 'common']);

  return (
    <Result
      title={t('todoComment:list.loadFailed')}
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
  );
};
interface TodoCommentOverviewRowProps extends Omit<ComponentProps<typeof Box>, 'children'> {
  item: TodoCommentOverviewItem;
}

function TodoCommentOverviewRow({ item, className, ...boxProps }: TodoCommentOverviewRowProps) {
  const navigation = useCommentConversationNavigation(item.comment);
  const showsReplyConnection = item.previewReply !== null || item.replySummary.hasMore;

  return (
    <Box {...boxProps} className={cn('border-b border-gray-2', className)}>
      <TopLevelCommentSection comment={item.comment} connectsToReply={showsReplyConnection} />

      {item.previewReply !== null && <PreviewReplySection comment={item.previewReply} />}

      {item.replySummary.hasMore && (
        <Box pl={56} pr={16} pb={10}>
          <CommentReplySummary
            summary={item.replySummary}
            isLoading={navigation.isPreparing}
            onPress={() => {
              navigation.openThread().catch(() => undefined);
            }}
          />
        </Box>
      )}
    </Box>
  );
}

const PARTICIPANT_OVERLAP = '-ml-1.5';
const OVERVIEW_REPLY_CONNECTION = {
  railWidth: 2,
  avatarGap: 4,
  previewRailWidth: 40,
  previewTopOverlap: 8,
} as const;
const overviewRootAvatarAxis = TODO_COMMENT_AUTHOR_AVATAR_SIZE.md / 2;
const overviewPreviewAvatarAxis =
  OVERVIEW_REPLY_CONNECTION.previewRailWidth + TODO_COMMENT_AUTHOR_AVATAR_SIZE.sm / 2;

interface CommentReplySummaryProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityRole'
> {
  summary: TodoCommentReplySummary;
  isLoading?: boolean;
}

function CommentReplySummary({
  summary,
  isLoading = false,
  className,
  accessibilityLabel,
  accessibilityState,
  isDisabled,
  ...pressableProps
}: CommentReplySummaryProps) {
  const { t } = useTranslation('todoComment');
  const label = t('overview.viewReplies', { count: summary.hiddenCount });

  return (
    <PressableFeedback
      {...pressableProps}
      isDisabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        ...accessibilityState,
        busy: isLoading,
        disabled: isDisabled || isLoading,
      }}
      className={cn('min-h-11 flex-row items-center rounded-xl py-1', className)}
    >
      <HStack flex={1} gap={8} align="center">
        {summary.participantAuthors.length > 0 && (
          <HStack
            align="center"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {summary.participantAuthors.map((author, index) => (
              <Box key={author.id} className={cn(index > 0 && PARTICIPANT_OVERLAP)}>
                <TodoCommentAuthorAvatar
                  author={author}
                  size="xs"
                  className="border-2 border-background"
                />
              </Box>
            ))}
          </HStack>
        )}

        <Text size="b4" shade={6} weight="medium" className="flex-1">
          {label}
        </Text>
        {isLoading ? (
          <Box accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Spinner size="sm" />
          </Box>
        ) : (
          <ArrowRightIcon width={15} height={15} colorClassName="text-gray-5" />
        )}
      </HStack>
    </PressableFeedback>
  );
}

function TopLevelCommentSection({
  comment,
  connectsToReply,
}: {
  comment: TodoComment;
  connectsToReply: boolean;
}) {
  return (
    <HStack gap={12} align="start" px={16} pt={16} pb={connectsToReply ? 8 : 16}>
      <Box className="relative self-stretch">
        <TodoCommentAuthorAvatar author={comment.author} size="md" />
        {connectsToReply && (
          <Box
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute -bottom-2 rounded-full bg-gray-4"
            style={{
              left: overviewRootAvatarAxis - OVERVIEW_REPLY_CONNECTION.railWidth / 2,
              top: TODO_COMMENT_AUTHOR_AVATAR_SIZE.md + OVERVIEW_REPLY_CONNECTION.avatarGap,
              width: OVERVIEW_REPLY_CONNECTION.railWidth,
            }}
          />
        )}
      </Box>
      <TodoCommentArticle comment={comment} />
    </HStack>
  );
}

function PreviewReplySection({ comment }: { comment: TodoComment }) {
  return (
    <HStack align="start" px={16} pb={8}>
      <Box
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="relative h-7 w-10 shrink-0"
      >
        <Box
          className="absolute rounded-bl-2xl border-b-2 border-l-2 border-gray-4"
          style={{
            left: overviewRootAvatarAxis - OVERVIEW_REPLY_CONNECTION.railWidth / 2,
            top: -OVERVIEW_REPLY_CONNECTION.previewTopOverlap,
            width: overviewPreviewAvatarAxis - overviewRootAvatarAxis,
            height:
              OVERVIEW_REPLY_CONNECTION.previewTopOverlap + TODO_COMMENT_AUTHOR_AVATAR_SIZE.sm / 2,
          }}
        />
      </Box>
      <TodoCommentAuthorAvatar author={comment.author} size="sm" />
      <Box ml={10} flex={1}>
        <TodoCommentArticle comment={comment} />
      </Box>
    </HStack>
  );
}

TodoCommentOverviewRow.Loading = function Loading() {
  return (
    <VStack className="border-b border-gray-2 px-4 py-4" gap={10}>
      <HStack gap={12} align="start">
        <TodoCommentAuthorAvatar author={null} size="md" className="opacity-30" />
        <VStack flex={1} gap={8}>
          <Box className="h-4 w-24 rounded bg-gray-2" />
          <Box className="h-5 w-4/5 rounded bg-gray-2" />
          <Box className="h-4 w-28 rounded bg-gray-2" />
        </VStack>
      </HStack>
    </VStack>
  );
};

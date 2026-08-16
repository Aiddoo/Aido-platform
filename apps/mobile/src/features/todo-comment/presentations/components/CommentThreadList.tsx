import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ChatBubbleIcon,
  HStack,
  Result,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import { Separator, Skeleton } from 'heroui-native';
import { type ReactNode, memo, useCallback, useEffect, useRef } from 'react';
import { RefreshControl, type ScrollViewProps, View } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import { useResolveClassNames } from 'uniwind';

import type { TodoComment } from '../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';
import { CommentRowScrollContext } from '../hooks/use-comment-row-scroll';
import { useCommentSort } from '../hooks/use-comment-sort';
import { useThreadParentId } from '../hooks/use-thread-parent-id';
import { useTodoCommentsQueryOptions } from '../queries/use-todo-comment-query-options';
import { CommentActionMenu } from './CommentActionMenu';
import { CommentArticle } from './CommentArticle';
import { CommentAvatarColumn } from './CommentAvatarColumn';
import { CommentLikeButton } from './CommentLikeButton';
import { ReplyButton } from './ReplyButton';
import { ReplyPreview } from './ReplyPreview';

/**
 * 키보드가 떠도 레이아웃 프레임이 아니라 contentInset만 바뀌므로 FlashList가 리레이아웃되지 않는다.
 * 모듈 스코프에 둬야 FlashList가 매 렌더마다 스크롤뷰를 리마운트하지 않는다.
 */
const renderScrollComponent = (props: ScrollViewProps) => (
  <KeyboardChatScrollView
    {...props}
    keyboardLiftBehavior="always"
    automaticallyAdjustContentInsets={false}
    contentInsetAdjustmentBehavior="never"
  />
);

/**
 * 목록에서 한 댓글이 차지할 수 있는 최대 줄 수.
 * 글자를 키운 사용자도 한 화면에 여러 댓글을 훑을 수 있어야 해서 줄 수로 제한한다
 * (본문 자체는 서버 계약상 500자까지 들어올 수 있다).
 */
const LIST_CONTENT_MAX_LINES = 6;

/** 행 위아래 여백 — 이어지는 선이 이 틈을 건너가야 한 줄로 보인다. */
const ROW_TOP_PADDING = 14;
const ROW_BOTTOM_PADDING = 14;

/** 아바타 지름(size-9). 여기서 맺는 선은 이 뒤로 숨어 들어가며 끝난다. */
const AVATAR_SIZE = 36;

/** 아바타 한가운데(18px)를 지나는 1.5px 선. 좌표는 세 가지 경우가 공유한다. */
const THREAD_LINE = 'absolute left-[17px] w-[1.5px] bg-gray-4';

/** 매 렌더마다 새 함수가 생기면 FlashList가 행을 통째로 다시 그린다 — 모듈 스코프에 고정한다. */
const keyExtractor = (comment: TodoComment) => comment.id;

/** 같은 사람이 이어 쓴 댓글인지 — 두 행을 한 덩어리로 잇는 기준. */
const isSameAuthor = (one: TodoComment | undefined, other: TodoComment | undefined) =>
  one?.author != null && other?.author != null && one.author.id === other.author.id;

/**
 * 위 댓글에서 아래 댓글로 선이 이어지는지.
 * 답글이 달린 댓글은 이미 선을 답글 가지에 넘겼으므로, 아래 댓글까지 또 잇지 않는다 —
 * 두 갈래를 함께 그리면 답글 뭉치를 건너뛴 선이 허공에서 끊겨 보인다.
 */
const continuesInto = (one: TodoComment | undefined, other: TodoComment | undefined) =>
  isSameAuthor(one, other) && one?.hasReplies === false;

interface CommentThreadListProps {
  /** 댓글과 함께 스크롤되는 상단 영역 (할 일 본문, 조상 사슬, 정렬 바). */
  children?: ReactNode;
}

/**
 * 화면의 스크롤 컨테이너이자 댓글 목록.
 * 할 일 상세에서는 최상위 댓글을, 스레드 화면에서는 그 댓글의 직계 답글을 그린다 —
 * 두 경우의 캐시 모양이 같아 깊이가 얼마든 같은 무한 스크롤을 탄다.
 * 무엇을 볼지는 라우트에서 스스로 읽는다.
 */
export function CommentThreadList({ children }: CommentThreadListProps) {
  const { todoId } = useTodoScreenParams();
  const parentId = useThreadParentId();
  const [sort] = useCommentSort();
  const queryClient = useQueryClient();
  const { color: refreshTint } = useResolveClassNames('text-main');
  const listRef = useRef<FlashListRef<TodoComment>>(null);

  // 정렬을 바꾸면 줄 세우는 기준 자체가 달라진다.
  // 보던 자리를 붙잡아 두면 화면이 엉뚱한 곳으로 밀리므로, 맨 위에서 다시 읽게 한다.
  useEffect(() => {
    listRef.current?.scrollToTop({ animated: true });
  }, [sort]);

  const commentsQuery = useSuspenseInfiniteQuery(
    useTodoCommentsQueryOptions(todoId, parentId, sort),
  );
  // 방금 쓴 글은 정렬과 무관하게 맨 위에 꽂아두는데, 인기순에서는 좋아요가 0이라
  // 뒷 페이지에서 제자리로 한 번 더 실려 온다 — 먼저 그린 쪽만 남긴다.
  const comments = uniqBy(
    commentsQuery.data.pages.flatMap((page) => page.comments),
    (comment) => comment.id,
  );

  // 같은 사람이 이어 쓴 댓글은 구분선을 지우고 선으로 이어 한 흐름으로 읽히게 한다.
  const renderComment = useCallback(
    ({ item, index }: { item: TodoComment; index: number }) => (
      <CommentThreadList.Item
        comment={item}
        continuesFromAbove={continuesInto(comments[index - 1], item)}
        continuesBelow={continuesInto(item, comments[index + 1])}
      />
    ),
    [comments],
  );

  // 이 리스트가 화면의 스크롤 컨테이너이므로, 당겨서 새로고침은 화면 전체를 새로 받는다.
  const [isRefreshing, refresh] = useRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details(todoId) }),
      queryClient.invalidateQueries({ queryKey: TODO_COMMENT_QUERY_KEYS.all(todoId) }),
    ]),
  );

  const scrollRowToTop = useCallback(
    (commentId: string) => {
      const index = comments.findIndex((comment) => comment.id === commentId);

      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
      }
    },
    [comments],
  );

  return (
    <CommentRowScrollContext value={scrollRowToTop}>
      <FlashList
        ref={listRef}
        data={comments}
        keyExtractor={keyExtractor}
        renderItem={renderComment}
        extraData={comments}
        ListHeaderComponent={<>{children}</>}
        ListEmptyComponent={CommentThreadList.Empty}
        ListFooterComponent={
          commentsQuery.isFetchingNextPage ? <CommentThreadList.Loading rows={2} /> : null
        }
        renderScrollComponent={renderScrollComponent}
        onEndReached={() => {
          if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
            commentsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={refreshTint}
            colors={refreshTint != null ? [refreshTint] : undefined}
          />
        }
      />
    </CommentRowScrollContext>
  );
}

interface CommentThreadListItemProps {
  comment: TodoComment;
  /** 바로 위 댓글과 같은 사람이 쓴 경우 — 구분선 대신 선으로 잇는다. */
  continuesFromAbove: boolean;
  /** 바로 아래 댓글도 같은 사람이 쓴 경우 — 선을 아래로 내보낸다. */
  continuesBelow: boolean;
}

/**
 * 목록의 한 행 — 아바타 열, 댓글 글, 그리고 딸린 답글 맛보기. 행 여백은 여기서 정한다.
 * 좋아요 하나가 바뀌어도 그 행만 다시 그리도록 memo로 감싼다 (스크롤 중 프레임 보호).
 */
CommentThreadList.Item = memo(function Item({
  comment,
  continuesFromAbove,
  continuesBelow,
}: CommentThreadListItemProps) {
  return (
    <VStack>
      {/* 같은 사람이 이어 쓴 댓글에는 경계를 긋지 않는다.
          아바타를 잇는 선이 "이어짐"을 말하는데 그 위로 구분선을 그으면 두 신호가 서로를 부순다. */}
      {!continuesFromAbove && <Separator />}

      <VStack px={16} pt={ROW_TOP_PADDING} pb={ROW_BOTTOM_PADDING}>
        <HStack gap={10} className="relative">
          {/* 선은 행 여백까지 넘겨 그리고, 불투명한 아바타가 지나가는 자리를 가린다.
              여백마다 선을 이어 붙이지 않아 어디서도 끊기지 않는다. */}
          <CommentThreadLine
            reachesUp={continuesFromAbove}
            reachesDown={continuesBelow}
            endsAtReplies={comment.hasReplies}
          />

          <CommentAvatarColumn author={comment.author} />
          <CommentArticle
            comment={comment}
            menu={<CommentActionMenu comment={comment} />}
            // 긴 댓글은 목록에서 잘라 두고, 전문은 스레드에서 읽는다.
            contentMaxLines={LIST_CONTENT_MAX_LINES}
            // 사이를 벌리지 않는다 — 간격은 각 버튼이 품은 여백이 만들고,
            // 그래야 눌리는 영역이 맞닿아 빈틈도 겹침도 생기지 않는다.
            footer={
              <HStack align="center">
                <CommentLikeButton comment={comment} />
                <ReplyButton comment={comment} />
              </HStack>
            }
          />
        </HStack>

        {/* 답글은 행 전체 폭을 쓴다 — 아바타 아래 줄기에서 가지가 이어져 내려온다. */}
        <ReplyPreview comment={comment} />
      </VStack>
    </VStack>
  );
});

interface CommentThreadLineProps {
  /** 위 댓글에서 내려온 선을 받는지 */
  reachesUp: boolean;
  /** 아래 댓글로 선을 넘기는지 */
  reachesDown: boolean;
  /** 답글 영역이 이어받는지 — 그 아래는 답글 쪽 선이 그린다 */
  endsAtReplies: boolean;
}

/** 아바타 뒤를 지나가는 세로선. 그릴 게 없으면 아무것도 만들지 않는다. */
function CommentThreadLine({ reachesUp, reachesDown, endsAtReplies }: CommentThreadLineProps) {
  if (!reachesUp && !reachesDown && !endsAtReplies) {
    return null;
  }

  const top = reachesUp ? -ROW_TOP_PADDING : 0;

  // 아래로 넘겨줄 곳이 있을 때만 흘려보낸다 — 답글이 이어받으면 글 끝까지, 다음 댓글이면 행 밖까지.
  if (endsAtReplies || reachesDown) {
    return (
      <View
        pointerEvents="none"
        style={{ top, bottom: endsAtReplies ? 0 : -ROW_BOTTOM_PADDING }}
        className={THREAD_LINE}
      />
    );
  }

  // 넘겨줄 곳이 없으면 아바타 한가운데서 맺는다. 아바타가 가려 주므로 끊긴 자국이 남지 않는다.
  return (
    <View
      pointerEvents="none"
      style={{ top, height: -top + AVATAR_SIZE / 2 }}
      className={THREAD_LINE}
    />
  );
}

/** 비어 있다는 말은 지금 보고 있는 자리에 따라 다르다 — 할 일의 댓글인지, 그 댓글의 답글인지. */
CommentThreadList.Empty = function Empty() {
  const { t } = useTranslation('todoComment');
  const isThread = useThreadParentId() !== null;

  return (
    <Box py={48}>
      <Result
        icon={<ChatBubbleIcon width={72} height={72} colorClassName="text-gray-4" />}
        title={isThread ? t('thread.emptyRepliesTitle') : t('list.emptyTitle')}
        description={isThread ? t('thread.emptyRepliesDescription') : t('list.emptyDescription')}
      />
    </Box>
  );
};

CommentThreadList.Loading = function Loading({ rows = 4 }: { rows?: number }) {
  // 실제 목록은 화면의 스크롤 컨테이너로 남은 높이를 전부 차지한다. 폴백이 내용 높이만
  // 차지하면 그 아래 붙는 작성 입력창이 화면 한가운데로 딸려 올라온다.
  return (
    <VStack flex={1} px={16} py={12} gap={16}>
      {times(rows, (index) => (
        <HStack key={index} gap={10}>
          <Skeleton className="size-9 rounded-full" />
          <VStack flex={1} gap={6}>
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-5 w-4/5 rounded" />
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
};

CommentThreadList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todoComment', 'common']);

  return (
    <Result
      title={t('todoComment:list.loadFailed')}
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
  );
};

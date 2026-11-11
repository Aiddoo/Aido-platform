import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { Text, VStack } from '@src/shared/ui';
import { formatCompactCount } from '@src/shared/utils/number-format';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { match, P } from 'ts-pattern';

import {
  type TodoComment,
  TodoCommentPolicy,
  type TodoCommentThread,
  type TodoCommentThreadAnchor,
} from '../domains/todo-comment.model';
import { useGetTodoCommentRepliesInfiniteQueryOptions } from '../queries/todo-comment.queries';
import { getReplyFooter } from '../utils/todo-comment-replies.view-model';
import { useThreadExpansion } from './todo-comment-expansion';
import { TodoCommentItem } from './todo-comment-item';
import { TodoCommentRailRow } from './todo-comment-thread-rail';

interface TodoCommentRepliesProps {
  thread: TodoCommentThread;
  anchor: TodoCommentThreadAnchor | null;
  /** 알림으로 연 행을 지금 강조하는 동안만 true */
  isHighlightActive: boolean;
}

/**
 * 한 묶음의 답글. 접혀 있으면 서버가 고른 대표 답글 하나와 "답글 N개 더 보기"를, 펼치면 그 자리에서 답글 페이지를
 * 이어 붙인다. 위 행은 움직이지 않고 아래로만 늘어난다.
 */
export function TodoCommentReplies({ thread, anchor, isHighlightActive }: TodoCommentRepliesProps) {
  const [todoId] = useTodoId();
  const { trackEvent } = useTrack();
  const anchoredReplyId = anchor?.threadCommentId === thread.comment.id ? anchor.replyId : null;
  // 알림으로 연 답글은 사용자가 보려고 고른 것이라 직접 펼친 것으로 본다
  const [expansion, setExpansion] = useThreadExpansion(thread.comment.id, {
    isExpanded: anchoredReplyId != null,
    source: 'user',
  });
  const { isExpanded } = expansion;
  const queryClient = useQueryClient();
  const repliesOptions = useGetTodoCommentRepliesInfiniteQueryOptions({
    todoId,
    commentId: thread.comment.id,
    aroundReplyId: anchoredReplyId,
    isEnabled: isExpanded,
  });
  const repliesQuery = useInfiniteQuery(repliesOptions);

  // 펼친 뒤 실제로 불러온 답글 수를 페이지가 도착한 다음에 보낸다
  const trackLoadedCount = (loadedCount: number) =>
    trackEvent('todo_comment_replies_expanded', { todo_id: todoId, loaded_count: loadedCount });

  if (!isExpanded) {
    const preview = thread.previewReply;
    const hiddenCount = TodoCommentPolicy.getCollapsedHiddenReplyCount(thread);

    return (
      <VStack>
        {preview != null && (
          <ReplyRow reply={preview} isLast={hiddenCount === 0} isHighlighted={false} />
        )}
        {hiddenCount > 0 && (
          <TodoCommentReplies.Toggle
            label={{ kind: preview == null ? 'view' : 'viewMore', count: hiddenCount }}
            onPress={() => {
              setExpansion({ isExpanded: true, source: 'user' });
              queryClient
                .infiniteQuery({ ...repliesOptions, staleTime: 'static' })
                .then((replies) => trackLoadedCount(replies.length))
                .catch(noop);
            }}
          />
        )}
      </VStack>
    );
  }

  return match(repliesQuery)
    .with({ status: 'pending' }, () => (
      <TodoCommentRailRow kind={{ type: 'reply', isLast: true }}>
        <TodoCommentItem.Loading isReply />
      </TodoCommentRailRow>
    ))
    .with({ status: 'error', data: P.nullish }, () => (
      <TodoCommentReplies.Toggle
        label={{ kind: 'retry' }}
        onPress={() => {
          repliesQuery.refetch().catch(noop);
        }}
      />
    ))
    .otherwise(({ data, hasNextPage, hasPreviousPage, isFetchingNextPage }) => {
      const replies = data ?? [];
      const remaining = TodoCommentPolicy.getHiddenReplyCount(thread, replies.length);
      const footer = getReplyFooter(thread, {
        loadedCount: replies.length,
        hasNextPage,
        expansion,
      });
      const lastReplyId = footer === 'none' && !isFetchingNextPage ? replies.at(-1)?.id : null;

      return (
        <VStack>
          {hasPreviousPage && (
            <TodoCommentReplies.Toggle
              label={{ kind: 'viewMore', count: remaining }}
              isConnectedBelow
              onPress={() => {
                repliesQuery.fetchPreviousPage().catch(noop);
              }}
            />
          )}
          {replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              isLast={reply.id === lastReplyId}
              isHighlighted={isHighlightActive && reply.id === anchoredReplyId}
            />
          ))}
          {isFetchingNextPage ? (
            <TodoCommentRailRow kind={{ type: 'reply', isLast: true }}>
              <TodoCommentItem.Loading isReply />
            </TodoCommentRailRow>
          ) : (
            match(footer)
              .with('viewMore', () => (
                <TodoCommentReplies.Toggle
                  label={{ kind: 'viewMore', count: remaining }}
                  onPress={() => {
                    repliesQuery
                      .fetchNextPage()
                      .then((result) => trackLoadedCount(result.data?.length ?? replies.length))
                      .catch(noop);
                  }}
                />
              ))
              .with('hide', () => (
                <TodoCommentReplies.Toggle
                  label={{ kind: 'hide' }}
                  onPress={() => setExpansion({ isExpanded: false, source: 'user' })}
                />
              ))
              .with('none', () => null)
              .exhaustive()
          )}
        </VStack>
      );
    });
}

type ToggleLabel =
  | { kind: 'view' | 'viewMore'; count: number }
  | { kind: 'hide' }
  | { kind: 'retry' };

TodoCommentReplies.Toggle = function Toggle({
  label,
  isConnectedBelow = false,
  onPress,
}: {
  label: ToggleLabel;
  isConnectedBelow?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { resolvedLanguage } = useLanguage();
  const text = match(label)
    .with({ kind: 'view' }, ({ count }) =>
      t('replies.view', { count, formatted: formatCompactCount(count, resolvedLanguage) }),
    )
    .with({ kind: 'viewMore' }, ({ count }) =>
      t('replies.viewMore', { count, formatted: formatCompactCount(count, resolvedLanguage) }),
    )
    .with({ kind: 'hide' }, () => t('replies.hide'))
    .with({ kind: 'retry' }, () => t('replies.retry'))
    .exhaustive();

  return (
    <TodoCommentRailRow
      kind={isConnectedBelow ? { type: 'reply', isLast: false } : { type: 'toggle' }}
    >
      <PressableFeedback
        className="min-h-11 justify-center self-start pe-3"
        accessibilityRole="button"
        accessibilityLabel={text}
        onPress={onPress}
      >
        <Text size="e1" shade={7} weight="medium" numberOfLines={1}>
          {text}
        </Text>
      </PressableFeedback>
    </TodoCommentRailRow>
  );
};

function ReplyRow({
  reply,
  isLast,
  isHighlighted,
}: {
  reply: TodoComment;
  isLast: boolean;
  isHighlighted: boolean;
}) {
  return (
    <TodoCommentRailRow kind={{ type: 'reply', isLast }} isHighlighted={isHighlighted}>
      <TodoCommentItem comment={reply} />
    </TodoCommentRailRow>
  );
}

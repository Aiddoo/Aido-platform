import { HStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useCommentThreadParams } from '../hooks/use-comment-thread-params';
import { useTodoCommentThreadQueryOptions } from '../queries/use-todo-comment-query-options';
import { CommentActionMenu } from './CommentActionMenu';
import { CommentArticle } from './CommentArticle';
import { CommentAvatarColumn } from './CommentAvatarColumn';
import { CommentLikeButton } from './CommentLikeButton';
import { ReplyButton } from './ReplyButton';

/**
 * 스레드 화면이 지금 펼쳐 보고 있는 댓글 — 아래 답글들의 원본이다.
 * 앞 화면에서 넘어왔다면 그 목록 캐시로 첫 프레임이 즉시 채워진다.
 */
export function ThreadFocusedComment() {
  const { todoId, commentId } = useCommentThreadParams();
  const { data: thread } = useSuspenseQuery(useTodoCommentThreadQueryOptions(todoId, commentId));

  return (
    <HStack px={16} pb={12} gap={10}>
      {/* 위에서 내려온 연결선이 이 아바타에서 끝난다. */}
      <CommentAvatarColumn author={thread.comment.author} />

      <CommentArticle
        comment={thread.comment}
        menu={<CommentActionMenu comment={thread.comment} />}
        footer={
          <HStack align="center">
            <CommentLikeButton comment={thread.comment} />
            <ReplyButton comment={thread.comment} />
          </HStack>
        }
      />
    </HStack>
  );
}

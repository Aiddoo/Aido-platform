import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { HStack, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';

import type { TodoCommentPreview } from '../../models/todo-comment.model';
import { useCommentThreadParams } from '../hooks/use-comment-thread-params';
import { useTodoCommentThreadQueryOptions } from '../queries/use-todo-comment-query-options';
import { CommentActionMenu } from './CommentActionMenu';
import { CommentArticle } from './CommentArticle';
import { CommentAvatarColumn } from './CommentAvatarColumn';
import { CommentLikeButton } from './CommentLikeButton';
import { ReplyButton } from './ReplyButton';
import { ThreadConnectorDown } from './ThreadLine';

/**
 * 지금 보는 댓글까지 내려온 길 — 뿌리에서 부모까지 순서대로 쌓인다.
 * 조상도 그냥 댓글이라 좋아요와 답글이 열려 있고, 누르면 그 지점으로 올라간다.
 */
export function ThreadAncestors() {
  const { todoId, commentId } = useCommentThreadParams();
  const { data: thread } = useSuspenseQuery(useTodoCommentThreadQueryOptions(todoId, commentId));

  if (thread.ancestors.length === 0) {
    return null;
  }

  return (
    <VStack>
      {thread.ancestors.map((ancestor) => (
        <ThreadAncestorRow key={ancestor.id} comment={ancestor} />
      ))}
    </VStack>
  );
}

function ThreadAncestorRow({ comment }: { comment: TodoCommentPreview }) {
  const push = useSingleTap(router.push);

  const openAncestor = () =>
    push({
      pathname: '/todo/[todoId]/comment/[commentId]',
      params: { todoId: comment.todoId, commentId: comment.id },
    });

  return (
    <PressableFeedback onPress={openAncestor}>
      <VStack px={16}>
        <HStack pb={12} gap={10} className="relative">
          {/* 이 아바타에서 아래 줄까지 — 다음 조상, 끝내 펼쳐 보는 댓글로 이어진다. */}
          <ThreadConnectorDown />

          <CommentAvatarColumn author={comment.author} />
          <CommentArticle
            comment={comment}
            menu={<CommentActionMenu comment={comment} />}
            footer={
              <HStack align="center">
                <CommentLikeButton comment={comment} />
                <ReplyButton comment={comment} />
              </HStack>
            }
          />
        </HStack>
      </VStack>
    </PressableFeedback>
  );
}

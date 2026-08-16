import {
  HeartFilledIcon,
  HeartIcon,
  ICON_COUNT_BUTTON_ICON_SIZE,
  IconCountButton,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';

import { type TodoCommentPreview, TodoCommentPolicy } from '../../models/todo-comment.model';
import { useSetTodoCommentLikeMutationOptions } from '../queries/use-todo-comment-mutation-options';

interface CommentLikeButtonProps {
  comment: TodoCommentPreview;
}

export function CommentLikeButton({ comment }: CommentLikeButtonProps) {
  const likeComment = useMutation(useSetTodoCommentLikeMutationOptions(comment.todoId));

  return (
    <IconCountButton
      icon={
        comment.viewer.isLiked ? (
          <HeartFilledIcon
            width={ICON_COUNT_BUTTON_ICON_SIZE}
            height={ICON_COUNT_BUTTON_ICON_SIZE}
            colorClassName="text-error"
          />
        ) : (
          <HeartIcon
            width={ICON_COUNT_BUTTON_ICON_SIZE}
            height={ICON_COUNT_BUTTON_ICON_SIZE}
            colorClassName="text-gray-6"
          />
        )
      }
      count={comment.likeCount}
      // 연타로 PUT/DELETE가 엇갈리면 서버가 확정한 카운트가 뒤집힌다 — 한 번에 하나만 보낸다.
      isDisabled={!TodoCommentPolicy.canLike(comment) || likeComment.isPending}
      onPress={() =>
        likeComment.mutate({ commentId: comment.id, isLiked: !comment.viewer.isLiked })
      }
    />
  );
}

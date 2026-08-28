import type { TodoComment, TodoCommentLikeResult } from '../../models/todo-comment.model';

export function withOptimisticTodoCommentLike<C extends TodoComment>(
  comment: C,
  isLiked: boolean,
): C {
  return {
    ...comment,
    likeCount: Math.max(0, comment.likeCount + (isLiked ? 1 : -1)),
    viewer: { ...comment.viewer, isLiked },
  };
}

export function withTodoCommentLikeResult<C extends TodoComment>(
  comment: C,
  result: TodoCommentLikeResult,
): C {
  return {
    ...comment,
    likeCount: result.likeCount,
    viewer: { ...comment.viewer, isLiked: result.isLiked },
  };
}

export function withEditedTodoCommentContent<C extends TodoComment>(
  comment: C,
  content: string,
): C {
  return { ...comment, content, isEdited: true };
}

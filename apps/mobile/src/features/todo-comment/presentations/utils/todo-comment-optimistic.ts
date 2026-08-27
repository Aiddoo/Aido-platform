import type { TodoCommentLikeResult, TodoComment } from '../../models/todo-comment.model';

export function likeToggled<C extends TodoComment>(comment: C, isLiked: boolean): C {
  return {
    ...comment,
    likeCount: Math.max(0, comment.likeCount + (isLiked ? 1 : -1)),
    viewer: { ...comment.viewer, isLiked },
  };
}

export function likeSettled<C extends TodoComment>(comment: C, result: TodoCommentLikeResult): C {
  return {
    ...comment,
    likeCount: result.likeCount,
    viewer: { ...comment.viewer, isLiked: result.isLiked },
  };
}

export function contentEdited<C extends TodoComment>(comment: C, content: string): C {
  return { ...comment, content, isEdited: true };
}

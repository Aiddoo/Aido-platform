import type { TodoComment, TodoCommentAuthor, TodoCommentV2Author } from "@aido/api";

import type {
  TodoCommentRecord,
  TodoCommentViewerContext,
} from "../../../models/comments/todo-comment.types.js";
import { toTodoCommentView } from "../todo-comment.presenter.js";

/** v1 작성자는 userTag가 optional이라 값이 없으면 키를 뺀다. */
export function toTodoCommentAuthorResponse(author: TodoCommentV2Author): TodoCommentAuthor {
  return {
    id: author.id,
    name: author.name,
    userTag: author.userTag ?? undefined,
    profileImage: author.profileImage,
    isTodoOwner: author.isTodoOwner,
  };
}

/** 1.14.0 이하 앱은 parentId·depth로 들여쓰기를 그린다. 2단계라 parentId는 묶음 머리다. */
export function toTodoCommentResponse(
  record: TodoCommentRecord,
  viewer: TodoCommentViewerContext,
): TodoComment {
  const view = toTodoCommentView(record, viewer);

  return {
    id: view.id,
    threadId: view.threadCommentId ?? view.id,
    parentId: view.threadCommentId,
    depth: view.threadCommentId == null ? 0 : 1,
    author: view.author == null ? null : toTodoCommentAuthorResponse(view.author),
    content: view.content,
    isDeleted: view.isDeleted,
    isAuthorBlocked: view.isAuthorBlocked,
    isEdited: view.isEdited,
    likeCount: view.likeCount,
    replyCount: view.replyCount,
    replyTo: view.replyTo,
    viewer: view.viewer,
    createdAt: view.createdAt,
    editedAt: view.editedAt,
  };
}

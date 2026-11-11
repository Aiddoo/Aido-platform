import type {
  TodoCommentReadModel,
  TodoCommentViewer,
} from "#api/modules/engagement/comments/application/read-models/todo-comment.read-model";
import {
  TodoCommentLike,
  type TodoCommentLikePrimitives,
} from "#api/modules/engagement/comments/domain/todo-comment-like.entity";
import {
  TodoComment,
  type TodoCommentPrimitives,
} from "#api/modules/engagement/comments/domain/todo-comment.aggregate";

export const TODO_COMMENT_FIXTURE_NOW = Temporal.Instant.from("2026-08-26T00:00:00Z");
export const TODO_COMMENT_FIXTURE_TODO_ID = 1;
export const TODO_COMMENT_FIXTURE_OWNER_ID = "cmowner000000000000000001";
export const TODO_COMMENT_FIXTURE_VIEWER_ID = "cmviewer00000000000000001";
export const TODO_COMMENT_FIXTURE_FRIEND_ID = "cmfriend00000000000000001";

let requestSequence = 0;

export function nextClientRequestId(): string {
  requestSequence += 1;
  return `00000000-0000-4000-8000-${String(requestSequence).padStart(12, "0")}`;
}

export function createTodoCommentFixture(
  overrides: Partial<TodoCommentPrimitives> = {},
): TodoComment {
  return TodoComment.reconstitute({
    id: "cm1rootcomment000000000001",
    todoId: TODO_COMMENT_FIXTURE_TODO_ID,
    authorId: TODO_COMMENT_FIXTURE_OWNER_ID,
    parentId: null,
    replyToCommentId: null,
    clientRequestId: nextClientRequestId(),
    requestFingerprint: null,
    content: "댓글 원문",
    likeCount: 0,
    replyCount: 0,
    deletedAt: null,
    editedAt: null,
    createdAt: TODO_COMMENT_FIXTURE_NOW,
    updatedAt: TODO_COMMENT_FIXTURE_NOW,
    ...overrides,
  });
}

export function createTodoCommentLikeFixture(
  overrides: Partial<TodoCommentLikePrimitives> = {},
): TodoCommentLike {
  return TodoCommentLike.reconstitute({
    commentId: "cm1rootcomment000000000001",
    userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    isActive: true,
    notifiedAt: null,
    createdAt: TODO_COMMENT_FIXTURE_NOW,
    updatedAt: TODO_COMMENT_FIXTURE_NOW,
    ...overrides,
  });
}

export function createTodoCommentReadModelFixture(
  overrides: Partial<TodoCommentReadModel> = {},
): TodoCommentReadModel {
  return {
    id: "cm1rootcomment000000000001",
    todoId: TODO_COMMENT_FIXTURE_TODO_ID,
    threadCommentId: null,
    replyToCommentId: null,
    replyToAuthorId: null,
    replyToAuthorName: null,
    authorId: TODO_COMMENT_FIXTURE_OWNER_ID,
    authorName: "작성자",
    authorUserTag: null,
    authorProfileImage: null,
    todoOwnerId: TODO_COMMENT_FIXTURE_OWNER_ID,
    content: "댓글",
    likeCount: 0,
    replyCount: 0,
    deletedAt: null,
    editedAt: null,
    createdAt: TODO_COMMENT_FIXTURE_NOW,
    ...overrides,
  };
}

export function createTodoCommentViewerFixture(
  overrides: Partial<TodoCommentViewer> = {},
): TodoCommentViewer {
  return {
    viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    likedCommentIds: new Set(),
    blockedAuthorIds: new Set(),
    ...overrides,
  };
}

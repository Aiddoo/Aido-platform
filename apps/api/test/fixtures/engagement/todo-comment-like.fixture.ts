import {
  TodoCommentLike,
  type TodoCommentLikePrimitives,
} from "#api/modules/engagement/todo-comment-likes/domain/todo-comment-like.aggregate";

import {
  TODO_COMMENT_FIXTURE_NOW,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "./todo-comment.fixture.js";

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

import type {
  TodoCommentRepliesResponse,
  TodoCommentThreadsResponse,
} from "@aido/api/contracts/todo-comment";

import type {
  TodoCommentRepliesPageReadModel,
  TodoCommentThreadsPageReadModel,
} from "../../../application/read-models/todo-comment.read-model.js";
import {
  findVisiblePreviewReply,
  toTodoCommentPaginationResponse,
  toVisibleParticipantAuthorResponses,
  toVisibleTodoCommentResponse,
} from "../visible-todo-comment-response.mapper.js";

export function toTodoCommentThreadsResponse(
  page: TodoCommentThreadsPageReadModel,
  appVersion?: string,
): TodoCommentThreadsResponse {
  return {
    items: page.items.map((item) => {
      const previewReply = findVisiblePreviewReply(item, page.viewer);
      return {
        comment: toVisibleTodoCommentResponse(item.comment, page.viewer, appVersion),
        previewReply:
          previewReply == null
            ? null
            : toVisibleTodoCommentResponse(previewReply, page.viewer, appVersion),
        replySummary: {
          totalCount: item.totalCount,
          hiddenCount: Math.max(0, item.totalCount - (previewReply == null ? 0 : 1)),
          participantAuthors: toVisibleParticipantAuthorResponses(item, page.viewer, appVersion),
        },
      };
    }),
    pagination: toTodoCommentPaginationResponse(page.pagination),
    anchor: page.anchor,
  };
}

export function toTodoCommentRepliesResponse(
  page: TodoCommentRepliesPageReadModel,
  appVersion?: string,
): TodoCommentRepliesResponse {
  return {
    items: page.items.map((comment) =>
      toVisibleTodoCommentResponse(comment, page.viewer, appVersion),
    ),
    pagination: toTodoCommentPaginationResponse(page.pagination),
  };
}

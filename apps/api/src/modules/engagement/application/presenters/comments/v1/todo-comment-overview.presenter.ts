import type { TodoCommentOverviewResponse } from "@aido/api";

import type { TodoCommentThreadsResult } from "../../../models/comments/todo-comment.types.js";
import { toTodoCommentParticipantAuthor } from "../todo-comment.presenter.js";
import { toTodoCommentAuthorResponse, toTodoCommentResponse } from "./todo-comment.presenter.js";

export function toTodoCommentOverviewResponse(
  result: TodoCommentThreadsResult,
): TodoCommentOverviewResponse {
  return {
    items: result.items.map((item) => {
      const hiddenCount = Math.max(0, item.totalCount - (item.previewReply == null ? 0 : 1));

      return {
        comment: toTodoCommentResponse(item.comment, result.viewer),
        previewReply:
          item.previewReply == null
            ? null
            : toTodoCommentResponse(item.previewReply, result.viewer),
        replySummary: {
          totalCount: item.totalCount,
          hiddenCount,
          hasMore: hiddenCount > 0,
          participantAuthors: item.participantAuthors
            .filter((author) => !result.viewer.blockedAuthorIds.has(author.id))
            .map((author) => toTodoCommentAuthorResponse(toTodoCommentParticipantAuthor(author))),
        },
      };
    }),
    pagination: result.pagination,
  };
}

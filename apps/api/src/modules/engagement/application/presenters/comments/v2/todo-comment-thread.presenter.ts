import type { TodoCommentRepliesResponse, TodoCommentThreadsResponse } from "@aido/api";

import type {
  TodoCommentRepliesResult,
  TodoCommentThreadsResult,
} from "../../../models/comments/todo-comment.types.js";
import { toTodoCommentParticipantAuthor, toTodoCommentView } from "../todo-comment.presenter.js";

export function toTodoCommentThreadsResponse(
  result: TodoCommentThreadsResult,
): TodoCommentThreadsResponse {
  return {
    items: result.items.map((item) => ({
      comment: toTodoCommentView(item.comment, result.viewer),
      previewReply:
        item.previewReply == null ? null : toTodoCommentView(item.previewReply, result.viewer),
      replySummary: {
        totalCount: item.totalCount,
        hiddenCount: Math.max(0, item.totalCount - (item.previewReply == null ? 0 : 1)),
        participantAuthors: item.participantAuthors
          .filter((author) => !result.viewer.blockedAuthorIds.has(author.id))
          .map(toTodoCommentParticipantAuthor),
      },
    })),
    pagination: result.pagination,
    anchor: result.anchor,
  };
}

export function toTodoCommentRepliesResponse(
  result: TodoCommentRepliesResult,
): TodoCommentRepliesResponse {
  return {
    items: result.items.map((record) => toTodoCommentView(record, result.viewer)),
    pagination: result.pagination,
  };
}

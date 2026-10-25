import type { TodoCommentOverviewItem } from "@aido/api";

import type { TodoCommentOverviewItemRecord } from "../../models/comments/todo-comment.types.js";
import { toTodoCommentAuthorResponse, toTodoCommentResponse } from "./todo-comment.presenter.js";

export function toTodoCommentOverviewItem(input: {
  record: TodoCommentOverviewItemRecord;
  viewerId: string;
  likedCommentIds: ReadonlySet<string>;
  blockedAuthorIds: ReadonlySet<string>;
}): TodoCommentOverviewItem {
  const previewCount = input.record.previewReply === null ? 0 : 1;
  const hiddenCount = Math.max(0, input.record.totalCount - previewCount);

  return {
    comment: toTodoCommentResponse(
      input.record.comment,
      input.viewerId,
      input.likedCommentIds,
      input.blockedAuthorIds,
    ),
    previewReply:
      input.record.previewReply === null
        ? null
        : toTodoCommentResponse(
            input.record.previewReply,
            input.viewerId,
            input.likedCommentIds,
            input.blockedAuthorIds,
          ),
    replySummary: {
      totalCount: input.record.totalCount,
      hiddenCount,
      hasMore: hiddenCount > 0,
      participantAuthors: input.record.participantAuthors
        .filter((author) => !input.blockedAuthorIds.has(author.id))
        .map(toTodoCommentAuthorResponse),
    },
  };
}

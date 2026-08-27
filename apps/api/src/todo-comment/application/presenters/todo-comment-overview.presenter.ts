import type { TodoCommentOverviewItem } from "@aido/validators";

import type { TodoCommentOverviewItemRecord } from "../types";
import { toTodoCommentAuthorResponse, toTodoCommentResponse } from "./todo-comment.presenter";

export function toTodoCommentOverviewItem(input: {
	record: TodoCommentOverviewItemRecord;
	viewerId: string;
	likedCommentIds: ReadonlySet<string>;
}): TodoCommentOverviewItem {
	const previewCount = input.record.previewReply === null ? 0 : 1;
	const hiddenCount = Math.max(0, input.record.totalCount - previewCount);

	return {
		comment: toTodoCommentResponse(input.record.comment, input.viewerId, input.likedCommentIds),
		previewReply:
			input.record.previewReply === null
				? null
				: toTodoCommentResponse(input.record.previewReply, input.viewerId, input.likedCommentIds),
		replySummary: {
			totalCount: input.record.totalCount,
			hiddenCount,
			hasMore: hiddenCount > 0,
			participantAuthors: input.record.participantAuthors.map(toTodoCommentAuthorResponse),
		},
	};
}

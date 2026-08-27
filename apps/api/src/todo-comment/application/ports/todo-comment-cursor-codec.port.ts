import type { TodoCommentSort } from "@aido/validators";

import type {
	TodoCommentOverviewCursor,
	TodoCommentOverviewRootRecord,
	TodoConversationCursor,
	TodoConversationRecord,
	TodoConversationScope,
} from "../types";

export const TODO_COMMENT_CURSOR_CODEC = Symbol("TODO_COMMENT_CURSOR_CODEC");

/**
 * 댓글 keyset 위치를 클라이언트가 조립하거나 변경할 수 없는 opaque cursor로 바꾼다.
 * 암호화와 직렬화 방식은 infrastructure가 소유한다.
 */
export interface TodoCommentCursorCodecPort {
	decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor;
	encodeConversation(
		record: TodoConversationRecord,
		sort: TodoCommentSort,
		scope?: TodoConversationScope,
	): string;
	decodeOverview(cursor: string, sort: TodoCommentSort): TodoCommentOverviewCursor;
	encodeOverview(record: TodoCommentOverviewRootRecord, sort: TodoCommentSort): string;
}

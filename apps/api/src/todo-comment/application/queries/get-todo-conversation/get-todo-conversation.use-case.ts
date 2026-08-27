import { ErrorCode } from "@aido/errors";
import type {
	TodoCommentSort,
	TodoConversationFocus,
	TodoConversationResponse,
} from "@aido/validators";
import { TODO_COMMENT_LIMITS } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import {
	TODO_COMMENT_CURSOR_CODEC,
	type TodoCommentCursorCodecPort,
} from "../../ports/todo-comment-cursor-codec.port";
import {
	TODO_COMMENT_READER,
	type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port";
import {
	toTodoCommentCursorPagination,
	collectCommentIds,
	toTodoConversationAncestorItems,
	toTodoConversationItems,
} from "../../presenters";
import type {
	ConversationPageMode,
	TodoCommentRecord,
	TodoConversationCursor,
	TodoConversationPosition,
	TodoConversationScope,
} from "../../types";

export interface GetTodoConversationInput {
	todoId: number;
	viewerId: string;
	sort: TodoCommentSort;
	focusCommentId?: string;
	before?: string;
	after?: string;
	size: number;
}

interface ConversationAnchor {
	mode: ConversationPageMode;
	scope: TodoConversationScope;
	commentId?: string;
	threadId?: string;
	position?: TodoConversationPosition;
}

function decodeCursor(
	cursor: string,
	sort: TodoCommentSort,
	todoId: number,
	cursorCodec: TodoCommentCursorCodecPort,
): TodoConversationCursor {
	const decoded = cursorCodec.decodeConversation(cursor, sort);

	if (decoded.todoId !== todoId) {
		throw new ApplicationException(ErrorCode.SYS_0002);
	}

	return decoded;
}

function getAnchor(
	input: GetTodoConversationInput,
	cursorCodec: TodoCommentCursorCodecPort,
): ConversationAnchor {
	if (input.focusCommentId !== undefined) {
		return { mode: "FOCUS", scope: "THREAD", commentId: input.focusCommentId };
	}

	if (input.before !== undefined) {
		const cursor = decodeCursor(input.before, input.sort, input.todoId, cursorCodec);
		return {
			mode: "BEFORE",
			scope: cursor.scope,
			commentId: cursor.commentId,
			threadId: cursor.threadId,
			position: cursor.position,
		};
	}

	if (input.after !== undefined) {
		const cursor = decodeCursor(input.after, input.sort, input.todoId, cursorCodec);
		return {
			mode: "AFTER",
			scope: cursor.scope,
			commentId: cursor.commentId,
			threadId: cursor.threadId,
			position: cursor.position,
		};
	}

	return { mode: "INITIAL", scope: "TODO" };
}

interface FocusAncestorContext {
	records: TodoCommentRecord[];
	omittedCount: number;
}

@Injectable()
export class GetTodoConversationUseCase {
	constructor(
		@Inject(TODO_COMMENT_READER)
		private readonly reader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_CURSOR_CODEC)
		private readonly cursorCodec: TodoCommentCursorCodecPort,
	) {}

	async execute(input: GetTodoConversationInput): Promise<TodoConversationResponse> {
		await assertTodoCommentAccess(this.reader, input.todoId, input.viewerId);
		const anchor = getAnchor(input, this.cursorCodec);
		const window = await this.reader.listConversation({
			todoId: input.todoId,
			sort: input.sort,
			size: input.size,
			mode: anchor.mode,
			scope: anchor.scope,
			anchorCommentId: anchor.commentId,
			anchorThreadId: anchor.threadId,
			anchorPosition: anchor.position,
		});

		const focusedRecord =
			window?.anchorIndex === null || window?.anchorIndex === undefined
				? undefined
				: window.items[window.anchorIndex];
		if (
			anchor.mode === "FOCUS" &&
			(window === null || focusedRecord === undefined || focusedRecord.id !== anchor.commentId)
		) {
			return this.toEmptyResponse(input.size);
		}

		if (window === null) {
			throw new ApplicationException(ErrorCode.SYS_0002);
		}

		const focusRecord = this.getFocusRecord(window.items, window.anchorIndex, anchor);
		const ancestorContext = await this.getFocusAncestors(input.todoId, focusRecord, window.items);
		const likedCommentIds = await this.reader.findLikedCommentIds(
			collectCommentIds([...window.items, ...ancestorContext.records]),
			input.viewerId,
		);
		const items = toTodoConversationItems({
			records: window.items,
			nextRecord: window.nextRecord,
			focusCommentId: focusRecord?.id ?? null,
			viewerId: input.viewerId,
			likedCommentIds,
		});
		const firstRecord = window.items.at(0);
		const lastRecord = window.items.at(-1);

		return {
			items,
			focus: this.toFocusResponse(
				focusRecord,
				window.anchorIndex,
				ancestorContext,
				input.viewerId,
				likedCommentIds,
			),
			pagination: toTodoCommentCursorPagination({
				size: input.size,
				hasPrevious: window.hasPrevious,
				hasNext: window.hasNext,
				previousCursor:
					window.hasPrevious && firstRecord
						? this.cursorCodec.encodeConversation(firstRecord, input.sort, anchor.scope)
						: null,
				nextCursor:
					window.hasNext && lastRecord
						? this.cursorCodec.encodeConversation(lastRecord, input.sort, anchor.scope)
						: null,
			}),
		};
	}

	private getFocusRecord(
		items: readonly TodoCommentRecord[],
		anchorIndex: number | null,
		anchor: ConversationAnchor,
	): TodoCommentRecord | null {
		if (anchor.mode !== "FOCUS") {
			return null;
		}

		const record = anchorIndex === null ? undefined : items[anchorIndex];

		if (record === undefined || record.id !== anchor.commentId) {
			throw new ApplicationException(ErrorCode.TODO_0831, { commentId: anchor.commentId });
		}

		return record.deletedAt === null ? record : null;
	}

	private toEmptyResponse(size: number): TodoConversationResponse {
		return {
			items: [],
			focus: null,
			pagination: toTodoCommentCursorPagination({
				size,
				hasPrevious: false,
				hasNext: false,
				previousCursor: null,
				nextCursor: null,
			}),
		};
	}

	private async getFocusAncestors(
		todoId: number,
		focusRecord: TodoCommentRecord | null,
		pageRecords: readonly TodoCommentRecord[],
	): Promise<FocusAncestorContext> {
		if (focusRecord === null) {
			return { records: [], omittedCount: 0 };
		}

		const pageCommentIds = new Set(pageRecords.map((record) => record.id));
		const missingAncestorIds = focusRecord.path.filter(
			(commentId) => !pageCommentIds.has(commentId),
		);
		const requestedIds = missingAncestorIds.slice(-TODO_COMMENT_LIMITS.FOCUS_ANCESTOR_MAX_SIZE);
		const records = await this.reader.findAncestors(todoId, requestedIds);

		return {
			records,
			omittedCount: Math.max(0, missingAncestorIds.length - records.length),
		};
	}

	private toFocusResponse(
		focusRecord: TodoCommentRecord | null,
		itemIndex: number | null,
		ancestorContext: FocusAncestorContext,
		viewerId: string,
		likedCommentIds: ReadonlySet<string>,
	): TodoConversationFocus | null {
		if (focusRecord === null || itemIndex === null) {
			return null;
		}

		return {
			commentId: focusRecord.id,
			itemIndex,
			precedingAncestors: toTodoConversationAncestorItems({
				records: ancestorContext.records,
				viewerId,
				likedCommentIds,
			}),
			omittedAncestorCount: ancestorContext.omittedCount,
		};
	}
}

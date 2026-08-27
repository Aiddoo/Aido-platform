import { ErrorCode } from "@aido/errors";
import type { TodoCommentOverviewResponse, TodoCommentSort } from "@aido/validators";
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
import { toTodoCommentCursorPagination, toTodoCommentOverviewItem } from "../../presenters";
import type {
	OverviewPageMode,
	TodoCommentOverviewCursor,
	TodoCommentRootPosition,
} from "../../types";

export interface GetTodoCommentOverviewInput {
	todoId: number;
	viewerId: string;
	sort: TodoCommentSort;
	before?: string;
	after?: string;
	size: number;
}

interface OverviewAnchor {
	mode: OverviewPageMode;
	rootId?: string;
	position?: TodoCommentRootPosition;
}

function decodeCursor(
	cursor: string,
	sort: TodoCommentSort,
	todoId: number,
	cursorCodec: TodoCommentCursorCodecPort,
): TodoCommentOverviewCursor {
	const decoded = cursorCodec.decodeOverview(cursor, sort);

	if (decoded.todoId !== todoId) {
		throw new ApplicationException(ErrorCode.SYS_0002);
	}

	return decoded;
}

function getAnchor(
	input: GetTodoCommentOverviewInput,
	cursorCodec: TodoCommentCursorCodecPort,
): OverviewAnchor {
	if (input.before !== undefined) {
		const cursor = decodeCursor(input.before, input.sort, input.todoId, cursorCodec);
		return { mode: "BEFORE", rootId: cursor.rootId, position: cursor.position };
	}

	if (input.after !== undefined) {
		const cursor = decodeCursor(input.after, input.sort, input.todoId, cursorCodec);
		return { mode: "AFTER", rootId: cursor.rootId, position: cursor.position };
	}

	return { mode: "INITIAL" };
}

@Injectable()
export class GetTodoCommentOverviewUseCase {
	constructor(
		@Inject(TODO_COMMENT_READER)
		private readonly reader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_CURSOR_CODEC)
		private readonly cursorCodec: TodoCommentCursorCodecPort,
	) {}

	async execute(input: GetTodoCommentOverviewInput): Promise<TodoCommentOverviewResponse> {
		await assertTodoCommentAccess(this.reader, input.todoId, input.viewerId);
		const anchor = getAnchor(input, this.cursorCodec);
		const window = await this.reader.listOverview({
			todoId: input.todoId,
			sort: input.sort,
			size: input.size,
			mode: anchor.mode,
			anchorRootId: anchor.rootId,
			anchorPosition: anchor.position,
		});

		if (window === null) {
			throw new ApplicationException(ErrorCode.SYS_0002);
		}

		const commentIds = window.items.flatMap((item) => [
			item.comment.id,
			...(item.previewReply === null ? [] : [item.previewReply.id]),
		]);
		const likedCommentIds = await this.reader.findLikedCommentIds(commentIds, input.viewerId);
		const firstRecord = window.items.at(0)?.comment;
		const lastRecord = window.items.at(-1)?.comment;

		return {
			items: window.items.map((record) =>
				toTodoCommentOverviewItem({ record, viewerId: input.viewerId, likedCommentIds }),
			),
			pagination: toTodoCommentCursorPagination({
				size: input.size,
				hasPrevious: window.hasPrevious,
				hasNext: window.hasNext,
				previousCursor:
					window.hasPrevious && firstRecord
						? this.cursorCodec.encodeOverview(firstRecord, input.sort)
						: null,
				nextCursor:
					window.hasNext && lastRecord
						? this.cursorCodec.encodeOverview(lastRecord, input.sort)
						: null,
			}),
		};
	}
}

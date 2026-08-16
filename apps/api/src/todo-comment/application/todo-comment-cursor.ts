import { ErrorCode } from "@aido/errors";
import { TODO_COMMENT_SORT, z, type TodoCommentSort } from "@aido/validators";

import { ApplicationException } from "@/shared/domain";

import type { TodoCommentCursor, TodoCommentRecord } from "./types";

const latestCursorSchema = z.object({
	v: z.literal(1),
	sort: z.literal(TODO_COMMENT_SORT.LATEST),
	createdAt: z.iso.datetime(),
	id: z.cuid(),
});

const popularCursorSchema = z.object({
	v: z.literal(1),
	sort: z.literal(TODO_COMMENT_SORT.POPULAR),
	likeCount: z.number().int().nonnegative(),
	replyCount: z.number().int().nonnegative(),
	createdAt: z.iso.datetime(),
	id: z.cuid(),
});

const cursorSchema = z.discriminatedUnion("sort", [latestCursorSchema, popularCursorSchema]);

function encode(value: unknown): string {
	return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(cursor: string): unknown {
	try {
		return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
	} catch {
		throw new ApplicationException(ErrorCode.SYS_0002, { cursor: "invalid" });
	}
}

export function decodeTodoCommentCursor(
	cursor: string | undefined,
	sort: TodoCommentSort,
): TodoCommentCursor | undefined {
	if (cursor === undefined) {
		return undefined;
	}

	const parsedCursor = cursorSchema.safeParse(decode(cursor));

	if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
		throw new ApplicationException(ErrorCode.SYS_0002, { cursor: "invalid" });
	}

	return parsedCursor.data;
}

export function encodeTodoCommentCursor(record: TodoCommentRecord, sort: TodoCommentSort): string {
	if (sort === TODO_COMMENT_SORT.LATEST) {
		return encode({
			v: 1,
			sort,
			createdAt: record.createdAt,
			id: record.id,
		});
	}

	return encode({
		v: 1,
		sort,
		likeCount: record.likeCount,
		replyCount: record.replyCount,
		createdAt: record.createdAt,
		id: record.id,
	});
}

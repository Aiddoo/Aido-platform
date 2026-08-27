import { createHmac, timingSafeEqual } from "node:crypto";

import { ErrorCode } from "@aido/errors";
import { TODO_COMMENT_SORT, z, type TodoCommentSort } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type { TodoCommentCursorCodecPort } from "../../application/ports/todo-comment-cursor-codec.port";
import type {
	TodoCommentOverviewCursor,
	TodoCommentOverviewRootRecord,
	TodoConversationCursor,
	TodoConversationRecord,
	TodoConversationScope,
} from "../../application/types";

const CURSOR_DOMAIN = "todo-comment-cursor:v1:";
const postgresCountSchema = z.number().int().min(0).max(2_147_483_647);
const cursorPositionSchema = z
	.object({
		rootLikeCount: postgresCountSchema,
		rootReplyCount: postgresCountSchema,
	})
	.strict();
const conversationCursorSchema = z
	.object({
		v: z.literal(1),
		kind: z.literal("conversation"),
		sort: z.enum(TODO_COMMENT_SORT),
		todoId: z.number().int().positive(),
		commentId: z.cuid(),
		threadId: z.cuid(),
		scope: z.enum(["TODO", "THREAD"]),
		position: cursorPositionSchema,
	})
	.strict();
const overviewCursorSchema = z
	.object({
		v: z.literal(1),
		kind: z.literal("overview"),
		sort: z.enum(TODO_COMMENT_SORT),
		todoId: z.number().int().positive(),
		rootId: z.cuid(),
		position: cursorPositionSchema,
	})
	.strict();

function invalidCursor(): ApplicationException {
	return new ApplicationException(ErrorCode.SYS_0002);
}

@Injectable()
export class HmacTodoCommentCursorCodec implements TodoCommentCursorCodecPort {
	constructor(private readonly config: TypedConfigService) {}

	decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor {
		const parsedCursor = conversationCursorSchema.safeParse(this.decode(cursor));

		if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
			throw invalidCursor();
		}

		return parsedCursor.data;
	}

	encodeConversation(
		record: TodoConversationRecord,
		sort: TodoCommentSort,
		scope: TodoConversationScope = "TODO",
	): string {
		const cursor = conversationCursorSchema.safeParse({
			v: 1,
			kind: "conversation",
			sort,
			todoId: record.todoId,
			commentId: record.id,
			threadId: record.rootId ?? record.id,
			scope,
			position: record.conversationPosition,
		});

		if (!cursor.success) {
			throw invalidCursor();
		}

		return this.encode(cursor.data);
	}

	decodeOverview(cursor: string, sort: TodoCommentSort): TodoCommentOverviewCursor {
		const parsedCursor = overviewCursorSchema.safeParse(this.decode(cursor));

		if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
			throw invalidCursor();
		}

		return parsedCursor.data;
	}

	encodeOverview(record: TodoCommentOverviewRootRecord, sort: TodoCommentSort): string {
		if (record.parentId !== null || record.rootId !== null) {
			throw invalidCursor();
		}

		const cursor = overviewCursorSchema.safeParse({
			v: 1,
			kind: "overview",
			sort,
			todoId: record.todoId,
			rootId: record.id,
			position: record.overviewPosition,
		});

		if (!cursor.success) {
			throw invalidCursor();
		}

		return this.encode(cursor.data);
	}

	private encode(value: unknown): string {
		const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
		return `${payload}.${this.sign(payload)}`;
	}

	private decode(cursor: string): unknown {
		const [payload, signature, extra] = cursor.split(".");
		if (
			payload === undefined ||
			payload.length === 0 ||
			signature === undefined ||
			signature.length === 0 ||
			extra !== undefined ||
			!this.hasValidSignature(payload, signature)
		) {
			throw invalidCursor();
		}

		try {
			return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
		} catch {
			throw invalidCursor();
		}
	}

	private hasValidSignature(payload: string, signature: string): boolean {
		const actual = Buffer.from(signature, "base64url");
		const expected = Buffer.from(this.sign(payload), "base64url");
		return actual.length === expected.length && timingSafeEqual(actual, expected);
	}

	private sign(payload: string): string {
		return createHmac("sha256", this.config.jwtSecret)
			.update(`${CURSOR_DOMAIN}${payload}`)
			.digest("base64url");
	}
}

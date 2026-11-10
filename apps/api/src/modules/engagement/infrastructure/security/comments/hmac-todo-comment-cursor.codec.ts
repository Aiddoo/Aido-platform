import { TODO_COMMENT_SORT, z, type TodoCommentSort } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { HmacTokenSigner } from "#api/platform/security/hmac-token-signer";
import { SigningKeyRing } from "#api/platform/security/signing-key-ring";
import { ApplicationException } from "#api/shared/application/application.exception";

import {
  TODO_COMMENT_PAGE_DIRECTION,
  type TodoCommentPageDirection,
  type TodoCommentRecord,
  type TodoCommentRepliesCursor,
  type TodoCommentThreadCursor,
  type TodoCommentThreadRecord,
  type TodoConversationCursor,
  type TodoConversationRecord,
  type TodoConversationScope,
} from "../../../application/models/comments/todo-comment.types.js";
import type { TodoCommentCursorCodecPort } from "../../../application/ports/comments/todo-comment-cursor-codec.port.js";

const CURSOR_DOMAIN = {
  legacyPrefix: "todo-comment-cursor:v1:",
  keyedPrefix: "todo-comment-cursor:v2:",
};
const postgresCountSchema = z.number().int().min(0).max(2_147_483_647);
const cursorPositionSchema = z.strictObject({
  rootLikeCount: postgresCountSchema,
  rootReplyCount: postgresCountSchema,
});
const conversationCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal("conversation"),
  sort: z.enum(TODO_COMMENT_SORT),
  todoId: z.number().int().positive(),
  commentId: z.cuid(),
  threadId: z.cuid(),
  scope: z.enum(["TODO", "THREAD"]),
  position: cursorPositionSchema,
});
const directionSchema = z.enum(TODO_COMMENT_PAGE_DIRECTION);
const threadsCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal("overview"),
  sort: z.enum(TODO_COMMENT_SORT),
  todoId: z.number().int().positive(),
  rootId: z.cuid(),
  position: cursorPositionSchema,
  direction: directionSchema.optional(),
});
const repliesCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal("replies"),
  todoId: z.number().int().positive(),
  threadCommentId: z.cuid(),
  replyId: z.cuid(),
  direction: directionSchema,
});

function invalidCursor(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002);
}

@Injectable()
export class HmacTodoCommentCursorCodec implements TodoCommentCursorCodecPort {
  readonly #signer: HmacTokenSigner;

  constructor(config: TypedConfigService) {
    const ring = SigningKeyRing.fromEnv({
      configured: config.cursorSigningKeys,
      legacySecret: config.jwtSecret,
    });
    this.#signer = new HmacTokenSigner(ring, CURSOR_DOMAIN);
  }

  decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor {
    const parsedCursor = conversationCursorSchema.safeParse(this.#decode(cursor));

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
    return this.#encodeParsed(conversationCursorSchema, {
      v: 1,
      kind: "conversation",
      sort,
      todoId: record.todoId,
      commentId: record.id,
      threadId: record.threadCommentId ?? record.id,
      scope,
      position: record.conversationPosition,
    });
  }

  decodeThreads(cursor: string, sort: TodoCommentSort): TodoCommentThreadCursor {
    const parsedCursor = threadsCursorSchema.safeParse(this.#decode(cursor));

    if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
      throw invalidCursor();
    }

    return parsedCursor.data;
  }

  encodeThreads(
    record: TodoCommentThreadRecord,
    sort: TodoCommentSort,
    direction: TodoCommentPageDirection,
  ): string {
    if (record.threadCommentId != null) {
      throw invalidCursor();
    }

    return this.#encodeParsed(threadsCursorSchema, {
      v: 1,
      kind: "overview",
      sort,
      todoId: record.todoId,
      rootId: record.id,
      position: record.threadPosition,
      direction,
    });
  }

  decodeReplies(cursor: string): TodoCommentRepliesCursor {
    const parsedCursor = repliesCursorSchema.safeParse(this.#decode(cursor));

    if (!parsedCursor.success) {
      throw invalidCursor();
    }

    return parsedCursor.data;
  }

  encodeReplies(record: TodoCommentRecord, direction: TodoCommentPageDirection): string {
    if (record.threadCommentId == null) {
      throw invalidCursor();
    }

    return this.#encodeParsed(repliesCursorSchema, {
      v: 1,
      kind: "replies",
      todoId: record.todoId,
      threadCommentId: record.threadCommentId,
      replyId: record.id,
      direction,
    });
  }

  #encodeParsed<Schema extends z.ZodType>(schema: Schema, value: z.input<Schema>): string {
    const cursor = schema.safeParse(value);

    if (!cursor.success) {
      throw invalidCursor();
    }

    const payload = Buffer.from(JSON.stringify(cursor.data), "utf8").toString("base64url");
    return this.#signer.sign(payload);
  }

  #decode(cursor: string): unknown {
    const payload = this.#signer.open(cursor);
    if (payload == null) {
      throw invalidCursor();
    }

    try {
      return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw invalidCursor();
    }
  }
}

import { TODO_COMMENT_SORT, type TodoCommentSort } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { HmacTokenSigner } from "#api/platform/security/hmac-token-signer";
import { SigningKeyRing } from "#api/platform/security/signing-key-ring";

import { invalidCommentRequest } from "../../application/comments.errors.js";
import {
  TodoCommentCursorCodecPort,
  type TodoCommentRepliesCursor,
  type TodoCommentThreadCursor,
  type TodoConversationCursor,
} from "../../application/ports/todo-comment-cursor-codec.port.js";
import type {
  TodoCommentReadModel,
  TodoCommentThreadReadModel,
  TodoConversationReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import {
  TODO_COMMENT_PAGE_DIRECTIONS,
  TODO_CONVERSATION_SCOPES,
  type TodoCommentPageDirection,
  type TodoConversationScope,
} from "../../application/todo-comment-page.constants.js";
import {
  type EngagementCommentsConfig,
  engagementCommentsConfig,
} from "../../engagement-comments.config.js";

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
  scope: z.enum(TODO_CONVERSATION_SCOPES),
  position: cursorPositionSchema,
});
const directionSchema = z.enum(TODO_COMMENT_PAGE_DIRECTIONS);
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

@Injectable()
// 서명·payload 바이트는 출시 앱이 가진 cursor와 같아야 한다(접두사·키 이름·JSON 키 순서 포함)
export class HmacTodoCommentCursorCodecAdapter implements TodoCommentCursorCodecPort {
  readonly #signer: HmacTokenSigner;

  constructor(
    @Inject(engagementCommentsConfig.KEY) config: Pick<EngagementCommentsConfig, "cursorSigning">,
  ) {
    const ring = SigningKeyRing.fromEnv(config.cursorSigning);
    this.#signer = new HmacTokenSigner(ring, CURSOR_DOMAIN);
  }

  decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor {
    const parsedCursor = conversationCursorSchema.safeParse(this.#decode(cursor));

    if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
      throw invalidCommentRequest();
    }

    return parsedCursor.data;
  }

  encodeConversation(
    record: TodoConversationReadModel,
    sort: TodoCommentSort,
    scope: TodoConversationScope,
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
      throw invalidCommentRequest();
    }

    return parsedCursor.data;
  }

  encodeThreads(
    record: TodoCommentThreadReadModel,
    sort: TodoCommentSort,
    direction: TodoCommentPageDirection,
  ): string {
    if (record.threadCommentId != null) {
      throw invalidCommentRequest();
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
      throw invalidCommentRequest();
    }

    return parsedCursor.data;
  }

  encodeReplies(record: TodoCommentReadModel, direction: TodoCommentPageDirection): string {
    if (record.threadCommentId == null) {
      throw invalidCommentRequest();
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
      throw invalidCommentRequest();
    }

    const payload = Buffer.from(JSON.stringify(cursor.data), "utf8").toString("base64url");
    return this.#signer.sign(payload);
  }

  #decode(cursor: string): unknown {
    const payload = this.#signer.open(cursor);
    if (payload == null) {
      throw invalidCommentRequest();
    }

    try {
      return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw invalidCommentRequest();
    }
  }
}

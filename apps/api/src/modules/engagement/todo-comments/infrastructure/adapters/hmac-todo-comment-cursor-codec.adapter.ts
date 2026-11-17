import { TODO_COMMENT_SORT, type TodoCommentSort } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { HmacTokenSigner } from "#api/platform/security/hmac-token-signer";
import { SigningKeyRing } from "#api/platform/security/signing-key-ring";
import { isEntityId } from "#api/shared/domain/model/entity-id";

import { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
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
import { invalidCommentRequest } from "../../application/todo-comments.errors.js";
import {
  type EngagementTodoCommentsConfig,
  engagementTodoCommentsConfig,
} from "../../engagement-todo-comments.config.js";

const CURSOR_DOMAIN = {
  legacyPrefix: "todo-comment-cursor:v1:",
  keyedPrefix: "todo-comment-cursor:v2:",
};
const postgresCountSchema = z.number().int().min(0).max(2_147_483_647);
const cursorPositionSchema = z.strictObject({
  rootLikeCount: postgresCountSchema,
  rootReplyCount: postgresCountSchema,
});
const commentIdSchema = z.string().refine(isEntityId);

const conversationCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal("conversation"),
  sort: z.enum(TODO_COMMENT_SORT),
  todoId: z.number().int().positive(),
  commentId: commentIdSchema,
  threadId: commentIdSchema,
  scope: z.enum(TODO_CONVERSATION_SCOPES),
  position: cursorPositionSchema,
});
const directionSchema = z.enum(TODO_COMMENT_PAGE_DIRECTIONS);
const threadsCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal("overview"),
  sort: z.enum(TODO_COMMENT_SORT),
  todoId: z.number().int().positive(),
  rootId: commentIdSchema,
  position: cursorPositionSchema,
  direction: directionSchema.optional(),
});
const repliesCursorSchema = z.strictObject({
  v: z.literal(1),
  kind: z.literal("replies"),
  todoId: z.number().int().positive(),
  threadCommentId: commentIdSchema,
  replyId: commentIdSchema,
  direction: directionSchema,
});

@Injectable()
// 서명·payload 바이트는 출시 앱이 가진 cursor와 같아야 한다(접두사·키 이름·JSON 키 순서 포함)
export class HmacTodoCommentCursorCodecAdapter implements TodoCommentCursorCodecPort {
  readonly #signer: HmacTokenSigner;

  constructor(
    @Inject(engagementTodoCommentsConfig.KEY)
    config: Pick<EngagementTodoCommentsConfig, "cursorSigning">,
  ) {
    const ring = SigningKeyRing.fromEnv(config.cursorSigning);
    this.#signer = new HmacTokenSigner(ring, CURSOR_DOMAIN);
  }

  decodeConversation(cursor: string, sort: TodoCommentSort): TodoConversationCursor {
    const parsedCursor = conversationCursorSchema.safeParse(this.#decode(cursor));

    if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
      throw invalidCommentRequest();
    }

    const { data } = parsedCursor;
    return {
      sort: data.sort,
      todoId: TodoId.reconstitute(data.todoId),
      commentId: TodoCommentId.reconstitute(data.commentId),
      threadId: TodoCommentId.reconstitute(data.threadId),
      scope: data.scope,
      position: data.position,
    };
  }

  encodeConversation(
    item: TodoConversationReadModel,
    sort: TodoCommentSort,
    scope: TodoConversationScope,
  ): string {
    return this.#encodeParsed(conversationCursorSchema, {
      v: 1,
      kind: "conversation",
      sort,
      todoId: item.todoId,
      commentId: item.id,
      threadId: item.threadCommentId ?? item.id,
      scope,
      position: item.conversationPosition,
    });
  }

  decodeThreads(cursor: string, sort: TodoCommentSort): TodoCommentThreadCursor {
    const parsedCursor = threadsCursorSchema.safeParse(this.#decode(cursor));

    if (!parsedCursor.success || parsedCursor.data.sort !== sort) {
      throw invalidCommentRequest();
    }

    const { data } = parsedCursor;
    return {
      sort: data.sort,
      todoId: TodoId.reconstitute(data.todoId),
      rootId: TodoCommentId.reconstitute(data.rootId),
      position: data.position,
      direction: data.direction,
    };
  }

  encodeThreads(
    item: TodoCommentThreadReadModel,
    sort: TodoCommentSort,
    direction: TodoCommentPageDirection,
  ): string {
    if (item.threadCommentId != null) {
      throw invalidCommentRequest();
    }

    return this.#encodeParsed(threadsCursorSchema, {
      v: 1,
      kind: "overview",
      sort,
      todoId: item.todoId,
      rootId: item.id,
      position: item.threadPosition,
      direction,
    });
  }

  decodeReplies(cursor: string): TodoCommentRepliesCursor {
    const parsedCursor = repliesCursorSchema.safeParse(this.#decode(cursor));

    if (!parsedCursor.success) {
      throw invalidCommentRequest();
    }

    const { data } = parsedCursor;
    return {
      todoId: TodoId.reconstitute(data.todoId),
      threadCommentId: TodoCommentId.reconstitute(data.threadCommentId),
      replyId: TodoCommentId.reconstitute(data.replyId),
      direction: data.direction,
    };
  }

  encodeReplies(item: TodoCommentReadModel, direction: TodoCommentPageDirection): string {
    if (item.threadCommentId == null) {
      throw invalidCommentRequest();
    }

    return this.#encodeParsed(repliesCursorSchema, {
      v: 1,
      kind: "replies",
      todoId: item.todoId,
      threadCommentId: item.threadCommentId,
      replyId: item.id,
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

import { createHmac } from "node:crypto";

import { TODO_COMMENT_SORT, z } from "@aido/api";
import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type {
  TodoCommentThreadRecord,
  TodoConversationRecord,
} from "../../../application/models/comments/todo-comment.types.js";
import { HmacTodoCommentCursorCodec } from "./hmac-todo-comment-cursor.codec.js";

const record: TodoConversationRecord = {
  id: "cm1todoacomment00000000001",
  todoId: 1,
  threadCommentId: null,
  replyToCommentId: null,
  replyToAuthorId: null,
  replyToAuthorName: null,
  authorId: "cm1author0000000000000001",
  authorName: "작성자",
  authorUserTag: null,
  authorProfileImage: null,
  todoOwnerId: "cm1author0000000000000001",
  content: "댓글",
  likeCount: 3,
  replyCount: 2,
  deletedAt: null,
  editedAt: null,
  createdAt: "2026-08-14T00:00:00.000Z",
  conversationPosition: { rootLikeCount: 3, rootReplyCount: 2 },
};
const threadComment: TodoCommentThreadRecord = {
  ...record,
  threadPosition: record.conversationPosition,
};

function replacePayload(
  cursor: string,
  update: (payload: Record<string, unknown>) => void,
): string {
  const [encodedPayload, signature] = cursor.split(".");
  if (encodedPayload == null || signature == null) {
    throw new Error("테스트 cursor 형식이 올바르지 않습니다.");
  }

  const decoded = z
    .record(z.string(), z.unknown())
    .safeParse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
  if (!decoded.success) {
    throw new Error("테스트 cursor payload가 객체가 아닙니다.");
  }

  update(decoded.data);
  const tamperedPayload = Buffer.from(JSON.stringify(decoded.data), "utf8").toString("base64url");
  return `${tamperedPayload}.${signature}`;
}

describe("HmacTodoCommentCursorCodec", () => {
  let codec: HmacTodoCommentCursorCodec;
  let config: Mocked<TypedConfigService>;
  let secret: string;

  beforeEach(async () => {
    const testBed = await TestBed.solitary(HmacTodoCommentCursorCodec).compile();
    codec = testBed.unit;
    config = testBed.unitRef.get(TypedConfigService);
    secret = "test-jwt-secret-at-least-32-characters";
    Object.defineProperty(config, "jwtSecret", { configurable: true, get: () => secret });
  });

  it.each([TODO_COMMENT_SORT.LATEST, TODO_COMMENT_SORT.POPULAR])(
    "%s conversation cursor를 서명하고 경계를 복원한다",
    (sort) => {
      const cursor = codec.encodeConversation(record, sort);

      expect(codec.decodeConversation(cursor, sort)).toEqual({
        v: 1,
        kind: "conversation",
        sort,
        todoId: record.todoId,
        commentId: record.id,
        threadId: record.id,
        scope: "TODO",
        position: record.conversationPosition,
      });
    },
  );

  it("답글과 focus cursor의 thread 경계를 보존한다", () => {
    const reply = { ...record, id: "cm1todoacomment00000000002", threadCommentId: record.id };
    const cursor = codec.encodeConversation(reply, TODO_COMMENT_SORT.LATEST, "THREAD");

    expect(codec.decodeConversation(cursor, TODO_COMMENT_SORT.LATEST)).toMatchObject({
      threadId: record.id,
      scope: "THREAD",
    });
  });

  it("payload의 인기 rank를 변경하면 서명 검증에서 거부한다", () => {
    const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.POPULAR);
    const tampered = replacePayload(cursor, (payload) => {
      payload.position = { rootLikeCount: 400, rootReplyCount: 2 };
    });

    expect(() => codec.decodeConversation(tampered, TODO_COMMENT_SORT.POPULAR)).toThrow();
  });

  it("서명 한 글자를 변경하면 거부한다", () => {
    const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.LATEST);
    const [payload, signature] = cursor.split(".");
    if (payload == null || signature == null) {
      throw new Error("테스트 cursor 형식이 올바르지 않습니다.");
    }
    const first = signature.at(0);
    if (first == null) {
      throw new Error("테스트 cursor 서명이 비어 있습니다.");
    }
    const tampered = `${payload}.${first === "a" ? "b" : "a"}${signature.slice(1)}`;

    expect(() => codec.decodeConversation(tampered, TODO_COMMENT_SORT.LATEST)).toThrow();
  });

  it("다른 secret으로 만든 cursor를 거부한다", () => {
    const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.LATEST);
    secret = "another-jwt-secret-at-least-32-characters";

    expect(() => codec.decodeConversation(cursor, TODO_COMMENT_SORT.LATEST)).toThrow();
  });

  it("정렬 종류가 다른 cursor를 거부한다", () => {
    const cursor = codec.encodeConversation(record, TODO_COMMENT_SORT.LATEST);

    expect(() => codec.decodeConversation(cursor, TODO_COMMENT_SORT.POPULAR)).toThrow();
  });

  it("묶음 cursor를 conversation 경계로 재사용하지 못한다", () => {
    // Given
    const cursor = codec.encodeThreads(threadComment, TODO_COMMENT_SORT.LATEST, "AFTER");

    // When / Then
    expect(() => codec.decodeConversation(cursor, TODO_COMMENT_SORT.LATEST)).toThrow();
  });

  it.each([TODO_COMMENT_SORT.LATEST, TODO_COMMENT_SORT.POPULAR])(
    "%s 묶음 cursor를 서명하고 방향과 묶음 경계를 복원한다",
    (sort) => {
      // Given
      const cursor = codec.encodeThreads(threadComment, sort, "BEFORE");

      // When
      const decoded = codec.decodeThreads(cursor, sort);

      // Then
      expect(decoded).toEqual({
        v: 1,
        kind: "overview",
        sort,
        todoId: threadComment.todoId,
        rootId: threadComment.id,
        position: threadComment.threadPosition,
        direction: "BEFORE",
      });
    },
  );

  it("방향이 없는 1.14.0 이하 앱의 overview cursor도 읽는다", () => {
    // Given
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        kind: "overview",
        sort: TODO_COMMENT_SORT.LATEST,
        todoId: threadComment.todoId,
        rootId: threadComment.id,
        position: threadComment.threadPosition,
      }),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`todo-comment-cursor:v1:${payload}`)
      .digest("base64url");

    // When
    const decoded = codec.decodeThreads(`${payload}.${signature}`, TODO_COMMENT_SORT.LATEST);

    // Then
    expect(decoded).toMatchObject({ rootId: threadComment.id });
    expect(decoded.direction).toBeUndefined();
  });

  it("답글을 묶음 cursor로 만들지 않고, 댓글을 답글 cursor로 만들지 않는다", () => {
    // Given
    const reply: TodoCommentThreadRecord = {
      ...threadComment,
      id: "cm1todoacomment00000000002",
      threadCommentId: threadComment.id,
      replyToCommentId: threadComment.id,
    };

    // When / Then
    expect(() => codec.encodeThreads(reply, TODO_COMMENT_SORT.LATEST, "AFTER")).toThrow();
    expect(() => codec.encodeReplies(threadComment, "AFTER")).toThrow();
  });

  it("답글 cursor를 서명하고 묶음·방향을 복원하며 묶음 cursor와 섞이지 않는다", () => {
    // Given
    const reply = { ...record, id: "cm1todoacomment00000000002", threadCommentId: record.id };
    const cursor = codec.encodeReplies(reply, "AFTER");

    // When
    const decoded = codec.decodeReplies(cursor);

    // Then
    expect(decoded).toEqual({
      v: 1,
      kind: "replies",
      todoId: reply.todoId,
      threadCommentId: record.id,
      replyId: reply.id,
      direction: "AFTER",
    });
    expect(() => codec.decodeThreads(cursor, TODO_COMMENT_SORT.LATEST)).toThrow();
  });
});

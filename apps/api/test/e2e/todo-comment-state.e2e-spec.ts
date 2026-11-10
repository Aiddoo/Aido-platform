import { randomUUID } from "node:crypto";

import {
  createTodoResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoConversationResponseSchema,
} from "@aido/api";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { TodoCommentNotificationPort } from "#api/modules/engagement/comments/application/ports/todo-comment-notification.port";
import { notification } from "#api/platform/database/schema/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const COMMENT_TIME = new Date("2026-08-26T12:00:00.000Z");

describe("댓글 상태 HTTP 회귀", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    context = await createE2eApp();
  });
  afterAll(async () => {
    vi.useRealTimers();
    await destroyE2eApp(context);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(COMMENT_TIME);
  });
  afterEach(() => vi.useRealTimers());

  async function createTodo(accessToken: string): Promise<number> {
    const categoryId = await context.helpers.getDefaultCategoryId(accessToken);
    const response = await request(context.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "댓글 상태", categoryId, startDate: "2026-08-26", visibility: "PUBLIC" })
      .expect(201);
    return createTodoResponseSchema.parse(response.body.data).todo.id;
  }

  async function writeComment(
    accessToken: string,
    todoId: number,
    content: string,
    parentId: string | null = null,
  ): Promise<string> {
    const response = await request(context.app.getHttpServer())
      .post(`/v1/todos/${todoId}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ parentId, items: [{ clientRequestId: randomUUID(), content }] })
      .expect(201);
    const comment = todoCommentChainResponseSchema.parse(response.body.data).comments[0];
    if (comment === undefined) {
      throw new Error("댓글 fixture 응답이 비어 있습니다.");
    }
    return comment.id;
  }

  it("알림 저장 실패 후 같은 좋아요를 재시도하면 좋아요는 하나를 유지하고 알림만 한 번 저장한다", async () => {
    // Given
    const owner = await context.helpers.createVerifiedUser("comment-owner@test.com", "Test1234!");
    const friend = await context.helpers.createVerifiedUser("comment-friend@test.com", "Test1234!");
    await context.helpers.createFriendship(owner, friend);
    const todoId = await createTodo(owner.accessToken);
    const privateContent = "알림에 포함되면 안 되는 비공개 댓글 내용";
    const commentId = await writeComment(owner.accessToken, todoId, privateContent);
    const commentNotification = context.module.get(TodoCommentNotificationPort);
    vi.spyOn(commentNotification, "notifyCommentLiked").mockRejectedValueOnce(
      new Error("notification fixture failure"),
    );
    const client = context.testDatabase.getClient();
    const findLike = () =>
      client.query.todoCommentLike.findFirst({ where: { commentId, userId: friend.userId } });
    const like = () =>
      request(context.app.getHttpServer())
        .put(`/v1/todos/${todoId}/comments/${commentId}/likes`)
        .set("Authorization", `Bearer ${friend.accessToken}`)
        .expect(200);

    // When
    const first = await like();

    // Then
    expect(todoCommentLikeResponseSchema.parse(first.body.data)).toEqual({
      commentId,
      isLiked: true,
      likeCount: 1,
    });
    expect(await findLike()).toMatchObject({ isActive: true, notifiedAt: null });
    expect(
      await client
        .select()
        .from(notification)
        .where(and(eq(notification.userId, owner.userId), eq(notification.todoId, todoId))),
    ).toEqual([]);

    // When
    const retry = await like();
    await like();

    // Then
    expect(todoCommentLikeResponseSchema.parse(retry.body.data)).toEqual(first.body.data);
    expect(await findLike()).toMatchObject({
      isActive: true,
      notifiedAt: expect.any(Temporal.Instant),
    });
    expect(await client.query.todoComment.findFirst({ where: { id: commentId } })).toMatchObject({
      likeCount: 1,
    });
    const notifications = await client
      .select()
      .from(notification)
      .where(and(eq(notification.userId, owner.userId), eq(notification.todoId, todoId)));
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "TODO_SHARED",
      metadata: {
        senderId: friend.userId,
        commentId,
        threadRootId: commentId,
        activityKind: "LIKE",
      },
    });
    expect(JSON.stringify(notifications)).not.toContain(privateContent);
  });

  it("size 1 focus는 요청한 답글만 반환하고 조상 문맥과 같은 thread cursor를 유지한다", async () => {
    // Given
    const owner = await context.helpers.createVerifiedUser("comment-focus@test.com", "Test1234!");
    const todoId = await createTodo(owner.accessToken);
    // 작성 시각은 ClockPort가 정해 가짜 시계에서도 쓴 순서가 남도록 요청마다 1ms씩 옮긴다
    const rootId = await writeComment(owner.accessToken, todoId, "뿌리 댓글");
    vi.setSystemTime(new Date(COMMENT_TIME.getTime() + 1));
    const childId = await writeComment(owner.accessToken, todoId, "중간 답글", rootId);
    vi.setSystemTime(new Date(COMMENT_TIME.getTime() + 2));
    const leafId = await writeComment(owner.accessToken, todoId, "마지막 답글", childId);
    vi.setSystemTime(new Date(COMMENT_TIME.getTime() + 1000));
    const otherRootId = await writeComment(owner.accessToken, todoId, "다른 대화");

    // When
    const response = await request(context.app.getHttpServer())
      .get(`/v1/todos/${todoId}/conversation`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ focusCommentId: childId, size: 1 })
      .expect(200);
    const conversation = todoConversationResponseSchema.parse(response.body.data);

    // Then
    expect(conversation.items.map((item) => item.comment.id)).toEqual([childId]);
    expect(conversation.focus).toMatchObject({
      commentId: childId,
      itemIndex: 0,
      omittedAncestorCount: 0,
    });
    expect(conversation.focus?.precedingAncestors.map((item) => item.comment.id)).toEqual([rootId]);
    expect(conversation.items[0]?.isFocused).toBe(true);
    expect(conversation.pagination.hasNext).toBe(true);
    const nextCursor = conversation.pagination.nextCursor;
    if (nextCursor === null) {
      throw new Error("후속 답글 cursor가 없습니다.");
    }
    const nextResponse = await request(context.app.getHttpServer())
      .get(`/v1/todos/${todoId}/conversation`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ after: nextCursor, size: 1 })
      .expect(200);
    const next = todoConversationResponseSchema.parse(nextResponse.body.data);
    expect(next.items.map((item) => item.comment.id)).toEqual([leafId]);
    expect(next.items.some((item) => item.comment.id === otherRootId)).toBe(false);
    expect(next.pagination.hasNext).toBe(false);
  });
});

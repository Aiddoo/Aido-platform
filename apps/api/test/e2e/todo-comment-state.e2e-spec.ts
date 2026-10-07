import { randomUUID } from "node:crypto";

import {
  createTodoResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoConversationResponseSchema,
} from "@aido/api";
import request from "supertest";

import {
  TODO_COMMENT_NOTIFICATION,
  type TodoCommentNotificationPort,
} from "#api/modules/engagement/application/ports/comments/todo-comment-notification.port";

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
    if (comment === undefined) throw new Error("댓글 fixture 응답이 비어 있습니다.");
    return comment.id;
  }

  it("알림 저장 실패 후 같은 좋아요를 재시도하면 좋아요는 하나를 유지하고 알림만 한 번 저장한다", async () => {
    // Given: 알림 Port의 첫 호출만 실패시키고 실제 HTTP·저장소 경로는 유지한다.
    const owner = await context.helpers.createVerifiedUser("comment-owner@test.com", "Test1234!");
    const friend = await context.helpers.createVerifiedUser("comment-friend@test.com", "Test1234!");
    await context.helpers.createFriendship(owner, friend);
    const todoId = await createTodo(owner.accessToken);
    const privateContent = "알림에 포함되면 안 되는 비공개 댓글 내용";
    const commentId = await writeComment(owner.accessToken, todoId, privateContent);
    const notification = context.module.get<TodoCommentNotificationPort>(TODO_COMMENT_NOTIFICATION);
    vi.spyOn(notification, "notifyCommentLiked").mockRejectedValueOnce(
      new Error("notification fixture failure"),
    );
    const client = context.testDatabase.getClient();
    const like = () =>
      request(context.app.getHttpServer())
        .put(`/v1/todos/${todoId}/comments/${commentId}/likes`)
        .set("Authorization", `Bearer ${friend.accessToken}`)
        .expect(200);

    // When
    const first = await like();
    // Then: 실패한 알림 때문에 이미 저장한 좋아요나 REST 성공을 취소하지 않는다.
    expect(todoCommentLikeResponseSchema.parse(first.body.data)).toEqual({
      commentId,
      isLiked: true,
      likeCount: 1,
    });
    expect(
      await client.orm.public.TodoCommentLike.where({ commentId, userId: friend.userId }).first(),
    ).toMatchObject({ isActive: true, notifiedAt: null });
    expect(
      await client.orm.public.Notification.where({ userId: owner.userId, todoId }).all(),
    ).toEqual([]);

    // When
    const retry = await like();
    await like();
    // Then: 재전송은 중복 좋아요·알림을 만들지 않으며 알림에 본문을 노출하지 않는다.
    expect(todoCommentLikeResponseSchema.parse(retry.body.data)).toEqual(first.body.data);
    expect(
      await client.orm.public.TodoCommentLike.where({ commentId, userId: friend.userId }).first(),
    ).toMatchObject({ isActive: true, notifiedAt: expect.any(String) });
    expect(await client.orm.public.TodoComment.where({ id: commentId }).first()).toMatchObject({
      likeCount: 1,
    });
    const notifications = await client.orm.public.Notification.where({
      userId: owner.userId,
      todoId,
    }).all();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      _type: "TODO_SHARED",
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
    const rootId = await writeComment(owner.accessToken, todoId, "뿌리 댓글");
    const childId = await writeComment(owner.accessToken, todoId, "중간 답글", rootId);
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
    if (nextCursor === null) throw new Error("후속 답글 cursor가 없습니다.");
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

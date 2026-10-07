import { ErrorCode } from "@aido/errors";
import {
  createNudgeResponseSchema,
  createTodoResponseSchema,
  notificationInboxResponseSchema,
  notificationListResponseSchema,
  nudgeInteractionResponseSchema,
  nudgeInteractionsResponseSchema,
  nudgeThanksPreviewResponseSchema,
  sendNudgeThanksResponseSchema,
  type NudgeReplyKind,
} from "@aido/validators";
import { and } from "@prisma/orm-postgres/orm-client";
import request from "supertest";
import { z } from "zod";

import { NUDGE_INTERACTION_CONFIG } from "#api/nudge/application/ports/nudge-interaction.config.port";
import {
  NUDGE_NOTIFIER,
  type NudgeNotifierPort,
} from "#api/nudge/application/ports/nudge-notifier.port";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "./helpers/index.js";

describe("콕 답장·감사 E2E (실제 DB)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(NUDGE_INTERACTION_CONFIG).useValue({ isEnabled: true }),
    });
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  async function createTodo(owner: VerifiedUser) {
    const categoryId = await ctx.helpers.getDefaultCategoryId(owner.accessToken);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + 1);
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "산책 다녀오기",
        categoryId,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      })
      .expect(201);
    return createTodoResponseSchema.parse(response.body.data).todo;
  }

  async function sendNudge(sender: VerifiedUser, receiver: VerifiedUser, todoId: number) {
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/nudges")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send({ receiverId: receiver.userId, todoId })
      .expect(201);
    return createNudgeResponseSchema.parse(response.body.data).nudge;
  }

  function reply(receiver: VerifiedUser, nudgeId: number, replyKind: NudgeReplyKind) {
    return request(ctx.app.getHttpServer())
      .put(`/v1/nudges/${nudgeId}/reply`)
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .send({ replyKind });
  }

  function sendThanks(receiver: VerifiedUser, todoId: number, throughNudgeId: number) {
    return request(ctx.app.getHttpServer())
      .put(`/v1/nudges/todos/${todoId}/thanks`)
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .send({ throughNudgeId });
  }

  async function setCompleted(owner: VerifiedUser, todoId: number, completed: boolean) {
    await request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${todoId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ completed })
      .expect(200);
  }

  async function getThanksPreview(owner: VerifiedUser, todoId: number) {
    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/nudges/todos/${todoId}/thanks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    return nudgeThanksPreviewResponseSchema.parse(response.body.data);
  }

  it.each(["FREE", "ACTIVE"] as const)(
    "%s 사용자도 답장을 보내며 할 일 완료 상태는 바뀌지 않는다",
    async (subscriptionStatus) => {
      // Given
      const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
      const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
      await ctx.helpers.createFriendship(sender, receiver);
      decodeRecord(
        "User",
        requireRecord(
          await ctx.testDatabase
            .getClient()
            .orm.public.User.where((row) => row.id.eq(receiver.userId))
            .update(encodePatch("User", { subscriptionStatus })),
        ),
      );
      const todo = await createTodo(receiver);
      const nudge = await sendNudge(sender, receiver, todo.id);

      // When
      const response = await reply(receiver, nudge.id, "STARTING").expect(200);
      const interaction = nudgeInteractionResponseSchema.parse(response.body.data);

      // Then
      expect(interaction).toMatchObject({ replyKind: "STARTING", isAvailable: true });
      expect(interaction.readAt).not.toBeNull();
      expect(interaction.repliedAt).not.toBeNull();
      expect(interaction.todo?.completed).toBe(false);
      expect(
        (
          await ctx.testDatabase
            .getClient()
            .orm.public.Notification.where((row) =>
              and(
                row._type.eq("NUDGE_REPLIED"),
                row.nudgeId.eq(nudge.id),
                row.userId.eq(sender.userId),
              ),
            )
            .aggregate((aggregate) => ({ count: aggregate.count() }))
        ).count,
      ).toBe(1);
    },
  );

  it("같은 답장 동시 요청 20개에도 첫 답장 알림과 push outbox는 한 번만 저장한다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);

    // When
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => reply(receiver, nudge.id, "THANKFUL").expect(200)),
    );

    // Then
    expect(
      responses.map(
        (response) => nudgeInteractionResponseSchema.parse(response.body.data).replyKind,
      ),
    ).toEqual(Array.from({ length: 20 }, () => "THANKFUL"));
    const notifications = decodeRecord(
      "Notification",
      await ctx.testDatabase
        .getClient()
        .orm.public.Notification.where((row) =>
          and(row.nudgeId.eq(nudge.id), row._type.eq("NUDGE_REPLIED")),
        )
        .include("pushDispatch", (related) => related.include("outbox"))
        .all(),
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.metadata).toMatchObject({ copyRevision: "1.11.0" });
    expect(notifications[0]?.pushDispatch?.outbox).toMatchObject({
      dispatchId: expect.any(Number),
    });
  });

  it("답장을 변경해도 첫 답장·읽음 시각을 유지하고 알림을 반복하지 않는다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);
    const first = await reply(receiver, nudge.id, "STARTING").expect(200);
    const original = nudgeInteractionResponseSchema.parse(first.body.data);

    // When
    const changed = await reply(receiver, nudge.id, "LATER").expect(200);
    const repeated = await reply(receiver, nudge.id, "LATER").expect(200);

    // Then
    const current = nudgeInteractionResponseSchema.parse(changed.body.data);
    expect(current).toMatchObject({
      replyKind: "LATER",
      readAt: original.readAt,
      repliedAt: original.repliedAt,
    });
    expect(nudgeInteractionResponseSchema.parse(repeated.body.data)).toEqual(current);
    expect(
      (
        await ctx.testDatabase
          .getClient()
          .orm.public.Notification.where((row) =>
            and(row.nudgeId.eq(nudge.id), row._type.eq("NUDGE_REPLIED")),
          )
          .aggregate((aggregate) => ({ count: aggregate.count() }))
      ).count,
    ).toBe(1);
  });

  it("보낸 사람·제삼자는 답장을 보낼 수 없고 제삼자는 콕도 조회할 수 없다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    const stranger = await ctx.helpers.createVerifiedUser("stranger@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);

    // When
    const senderReply = await reply(sender, nudge.id, "STARTING").expect(404);
    const strangerReply = await reply(stranger, nudge.id, "STARTING").expect(404);
    const strangerQuery = await request(ctx.app.getHttpServer())
      .get(`/v1/nudges/${nudge.id}/interaction`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .expect(404);

    // Then
    for (const response of [senderReply, strangerReply, strangerQuery]) {
      expect(response.body.error.code).toBe(ErrorCode.NUDGE_1105);
    }
    expect(
      (
        await ctx.testDatabase
          .getClient()
          .orm.public.Notification.where((row) => row._type.eq("NUDGE_REPLIED"))
          .aggregate((aggregate) => ({ count: aggregate.count() }))
      ).count,
    ).toBe(0);
  });

  it("비공개로 변경한 할 일은 보낸 사람에게 가리고 답장을 차단한다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);
    await request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${todo.id}`)
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .send({ visibility: "PRIVATE" })
      .expect(200);

    // When
    const query = await request(ctx.app.getHttpServer())
      .get(`/v1/nudges/${nudge.id}/interaction`)
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .expect(200);
    const response = await reply(receiver, nudge.id, "STARTING").expect(409);

    // Then
    expect(nudgeInteractionResponseSchema.parse(query.body.data)).toMatchObject({
      todo: null,
      isAvailable: false,
    });
    expect(response.body.error.code).toBe(ErrorCode.NUDGE_1109);
  });

  it("캐시된 친구 정보가 있어도 친구 해제 직후에는 답장·감사를 차단한다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);
    await setCompleted(receiver, todo.id, true);
    await getThanksPreview(receiver, todo.id);
    await request(ctx.app.getHttpServer())
      .delete(`/v1/follows/${sender.userId}`)
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .expect(200);

    // When
    const response = await reply(receiver, nudge.id, "STARTING").expect(409);
    const thanks = await sendThanks(receiver, todo.id, nudge.id).expect(200);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.NUDGE_1109);
    expect(sendNudgeThanksResponseSchema.parse(thanks.body.data).sentCount).toBe(0);
    expect((await getThanksPreview(receiver, todo.id)).recipients).toEqual([]);
  });

  it("미완료 할 일에는 감사 미리보기와 전송을 허용하지 않는다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);

    // When
    const preview = await request(ctx.app.getHttpServer())
      .get(`/v1/nudges/todos/${todo.id}/thanks`)
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .expect(409);
    const thanks = await sendThanks(receiver, todo.id, nudge.id).expect(409);

    // Then
    expect(preview.body.error.code).toBe(ErrorCode.NUDGE_1110);
    expect(thanks.body.error.code).toBe(ErrorCode.NUDGE_1110);
  });

  it("같은 친구의 여러 콕을 묶고 감사 동시 요청 20개에도 친구별 한 번만 전한다", async () => {
    // Given
    const firstFriend = await ctx.helpers.createVerifiedUser("first@test.com", "Test1234!");
    const secondFriend = await ctx.helpers.createVerifiedUser("second@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(firstFriend, receiver);
    await ctx.helpers.createFriendship(secondFriend, receiver);
    const todo = await createTodo(receiver);
    await sendNudge(firstFriend, receiver, todo.id);
    await sendNudge(secondFriend, receiver, todo.id);
    decodeRecord(
      "Nudge",
      await ctx.testDatabase.getClient().orm.public.Nudge.create(
        encodeCreate("Nudge", {
          senderId: firstFriend.userId,
          receiverId: receiver.userId,
          todoId: todo.id,
        }),
      ),
    );
    await setCompleted(receiver, todo.id, true);
    const preview = await getThanksPreview(receiver, todo.id);
    expect(preview.recipients.map((friend) => friend.id).sort()).toEqual(
      [firstFriend.userId, secondFriend.userId].sort(),
    );
    if (preview.throughNudgeId === null) throw new Error("감사 대상 콕이 필요합니다");
    const throughNudgeId = preview.throughNudgeId;

    // When
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => sendThanks(receiver, todo.id, throughNudgeId).expect(200)),
    );

    // Then
    expect(
      responses
        .map((response) => sendNudgeThanksResponseSchema.parse(response.body.data).sentCount)
        .sort((a, b) => b - a),
    ).toEqual([2, ...Array.from({ length: 19 }, () => 0)]);
    const thanked = decodeRecord(
      "Nudge",
      await ctx.testDatabase
        .getClient()
        .orm.public.Nudge.where((row) => and(row.todoId.eq(todo.id), row.thankedAt.isNotNull()))
        .all(),
    );
    expect(thanked).toHaveLength(2);
    expect(
      (
        await ctx.testDatabase
          .getClient()
          .orm.public.Notification.where((row) =>
            and(row._type.eq("NUDGE_THANKED"), row.todoId.eq(todo.id)),
          )
          .aggregate((aggregate) => ({ count: aggregate.count() }))
      ).count,
    ).toBe(2);
    expect((await getThanksPreview(receiver, todo.id)).recipients).toEqual([]);
  });

  it("미리보기 이후의 콕은 제외하고 완료를 취소했다 다시 완료해도 감사를 반복하지 않는다", async () => {
    // Given
    const firstFriend = await ctx.helpers.createVerifiedUser("first@test.com", "Test1234!");
    const secondFriend = await ctx.helpers.createVerifiedUser("second@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(firstFriend, receiver);
    await ctx.helpers.createFriendship(secondFriend, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(firstFriend, receiver, todo.id);
    await setCompleted(receiver, todo.id, true);
    await getThanksPreview(receiver, todo.id);
    const laterNudge = decodeRecord(
      "Nudge",
      await ctx.testDatabase.getClient().orm.public.Nudge.create(
        encodeCreate("Nudge", {
          senderId: secondFriend.userId,
          receiverId: receiver.userId,
          todoId: todo.id,
        }),
      ),
    );

    // When
    const first = await sendThanks(receiver, todo.id, nudge.id).expect(200);
    await setCompleted(receiver, todo.id, false);
    await setCompleted(receiver, todo.id, true);
    const repeated = await sendThanks(receiver, todo.id, nudge.id).expect(200);

    // Then
    expect(sendNudgeThanksResponseSchema.parse(first.body.data).sentCount).toBe(1);
    expect(sendNudgeThanksResponseSchema.parse(repeated.body.data).sentCount).toBe(0);
    const preview = await getThanksPreview(receiver, todo.id);
    expect(preview.throughNudgeId).toBe(laterNudge.id);
    expect(preview.recipients.map((friend) => friend.id)).toEqual([secondFriend.userId]);
  });

  it("다른 할 일의 콕을 감사 기준으로 보내면 거절한다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const firstTodo = await createTodo(receiver);
    const secondTodo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, firstTodo.id);
    await setCompleted(receiver, secondTodo.id, true);

    // When
    const response = await sendThanks(receiver, secondTodo.id, nudge.id).expect(404);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.NUDGE_1105);
    expect(
      (
        await ctx.testDatabase
          .getClient()
          .orm.public.Nudge.where((row) => row.thankedAt.isNotNull())
          .aggregate((aggregate) => ({ count: aggregate.count() }))
      ).count,
    ).toBe(0);
  });

  it("알림 저장이 실패하면 답장도 함께 롤백하고 다음 재시도는 성공한다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const nudge = await sendNudge(sender, receiver, todo.id);
    vi.spyOn(
      ctx.module.get<NudgeNotifierPort>(NUDGE_NOTIFIER),
      "recordInteraction",
    ).mockRejectedValueOnce(new Error("알림 저장 실패"));

    // When
    await reply(receiver, nudge.id, "THANKFUL").expect(500);
    const rolledBack = decodeRecord(
      "Nudge",
      await ctx.testDatabase
        .getClient()
        .orm.public.Nudge.where((row) => row.id.eq(nudge.id))
        .first(),
    );
    const retried = await reply(receiver, nudge.id, "THANKFUL").expect(200);

    // Then
    expect(rolledBack).toMatchObject({ replyKind: null, repliedAt: null, readAt: null });
    expect(nudgeInteractionResponseSchema.parse(retried.body.data).replyKind).toBe("THANKFUL");
    expect(
      (
        await ctx.testDatabase
          .getClient()
          .orm.public.Notification.where((row) =>
            and(row._type.eq("NUDGE_REPLIED"), row.nudgeId.eq(nudge.id)),
          )
          .aggregate((aggregate) => ({ count: aggregate.count() }))
      ).count,
    ).toBe(1);
  });

  it("콕 목록은 관계를 해제해도 조회되며 커서로 중복 없이 다음 페이지를 읽는다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("sender@test.com", "Test1234!");
    const receiver = await ctx.helpers.createVerifiedUser("receiver@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, receiver);
    const todo = await createTodo(receiver);
    const firstNudge = await sendNudge(sender, receiver, todo.id);
    const secondNudge = decodeRecord(
      "Nudge",
      await ctx.testDatabase.getClient().orm.public.Nudge.create(
        encodeCreate("Nudge", {
          senderId: sender.userId,
          receiverId: receiver.userId,
          todoId: todo.id,
        }),
      ),
    );
    await request(ctx.app.getHttpServer())
      .delete(`/v1/follows/${sender.userId}`)
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .expect(200);

    // When
    const firstResponse = await request(ctx.app.getHttpServer())
      .get("/v1/nudges/interactions")
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .query({ direction: "received", limit: 1 })
      .expect(200);
    const firstPage = nudgeInteractionsResponseSchema.parse(firstResponse.body.data);
    const secondResponse = await request(ctx.app.getHttpServer())
      .get("/v1/nudges/interactions")
      .set("Authorization", `Bearer ${receiver.accessToken}`)
      .query({ direction: "received", limit: 1, cursor: firstPage.pagination.nextCursor })
      .expect(200);
    const secondPage = nudgeInteractionsResponseSchema.parse(secondResponse.body.data);

    // Then
    expect(firstPage.items.map((item) => item.id)).toEqual([secondNudge.id]);
    expect(firstPage.items[0]?.isAvailable).toBe(false);
    expect(firstPage.pagination.hasNext).toBe(true);
    expect(secondPage.items.map((item) => item.id)).toEqual([firstNudge.id]);
    expect(secondPage.pagination.hasNext).toBe(false);
  });

  it("구버전 알림 API와 헤더 없는 알림함은 새 유형을 제외하고 최신 알림함만 전체 읽음 처리한다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("user@test.com", "Test1234!");
    await ctx.testDatabase.getClient().orm.public.Notification.createAndCount(
      [
        {
          userId: user.userId,
          type: "NUDGE_RECEIVED",
          title: "기존 콕",
          body: "기존 사용자도 읽을 수 있어요",
        },
        { userId: user.userId, type: "NUDGE_REPLIED", title: "답장", body: "곧 시작해요" },
        { userId: user.userId, type: "NUDGE_THANKED", title: "감사", body: "함께 해줘 고마워요" },
      ].map((value) =>
        encodeCreate("Notification", {
          ...value,
          type: z.enum(["NUDGE_RECEIVED", "NUDGE_REPLIED", "NUDGE_THANKED"]).parse(value.type),
        }),
      ),
    );

    // When
    const original = await request(ctx.app.getHttpServer())
      .get("/v1/notifications")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const missingVersion = await request(ctx.app.getHttpServer())
      .get("/v1/notifications/inbox")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const latest = await request(ctx.app.getHttpServer())
      .get("/v1/notifications/inbox")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-App-Version", "1.11.0")
      .expect(200);
    const oldReadAll = await request(ctx.app.getHttpServer())
      .patch("/v1/notifications/read-all")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const remaining = await request(ctx.app.getHttpServer())
      .get("/v1/notifications/inbox/unread-count")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-App-Version", "1.11.0")
      .expect(200);
    const newReadAll = await request(ctx.app.getHttpServer())
      .patch("/v1/notifications/inbox/read-all")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-App-Version", "1.11.0")
      .expect(200);

    // Then
    expect(notificationListResponseSchema.parse(original.body.data)).toMatchObject({
      unreadCount: 1,
      hasMore: false,
    });
    expect(
      notificationInboxResponseSchema
        .parse(missingVersion.body.data)
        .notifications.map((item) => item.type),
    ).toEqual(["NUDGE_RECEIVED"]);
    expect(notificationInboxResponseSchema.parse(latest.body.data).notifications).toHaveLength(3);
    expect(notificationInboxResponseSchema.parse(latest.body.data).unreadCount).toBe(3);
    expect(oldReadAll.body.data.readCount).toBe(1);
    expect(remaining.body.data.unreadCount).toBe(2);
    expect(newReadAll.body.data.readCount).toBe(2);
  });
  it("페이지 미리보기는 같은 콕 경계를 유지하고 기존 요청은 모든 친구를 반환한다", async () => {
    // Given
    const owner = await ctx.helpers.createVerifiedUser("owner-page@test.com", "Test1234!");
    const firstFriend = await ctx.helpers.createVerifiedUser("first-page@test.com", "Test1234!");
    const secondFriend = await ctx.helpers.createVerifiedUser("second-page@test.com", "Test1234!");
    await ctx.helpers.createFriendship(firstFriend, owner);
    await ctx.helpers.createFriendship(secondFriend, owner);
    const todo = await createTodo(owner);
    await sendNudge(firstFriend, owner, todo.id);
    await sendNudge(secondFriend, owner, todo.id);
    await setCompleted(owner, todo.id, true);

    // When
    const firstResponse = await request(ctx.app.getHttpServer())
      .get(`/v1/nudges/todos/${todo.id}/thanks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ limit: 1 })
      .expect(200);
    const firstPage = nudgeThanksPreviewResponseSchema.parse(firstResponse.body.data);
    const secondResponse = await request(ctx.app.getHttpServer())
      .get(`/v1/nudges/todos/${todo.id}/thanks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ limit: 1, cursor: firstPage.nextCursor, throughNudgeId: firstPage.throughNudgeId })
      .expect(200);
    const secondPage = nudgeThanksPreviewResponseSchema.parse(secondResponse.body.data);
    const legacyPreview = await getThanksPreview(owner, todo.id);

    // Then
    expect(firstPage.totalRecipients).toBe(2);
    expect(firstPage.hasNext).toBe(true);
    expect(secondPage.hasNext).toBe(false);
    expect(secondPage.throughNudgeId).toBe(firstPage.throughNudgeId);
    expect(firstPage.recipients[0]?.id).not.toBe(secondPage.recipients[0]?.id);
    expect(legacyPreview.recipients).toHaveLength(2);
    const sent = await sendThanks(owner, todo.id, firstPage.throughNudgeId ?? 0).expect(200);
    expect(sent.body.data.sentCount).toBe(2);
  });

  it("감사 배치 알림 저장에 실패하면 모든 감사 상태를 롤백한다", async () => {
    // Given
    const sender = await ctx.helpers.createVerifiedUser("thanks-sender@test.com", "Test1234!");
    const owner = await ctx.helpers.createVerifiedUser("thanks-owner@test.com", "Test1234!");
    await ctx.helpers.createFriendship(sender, owner);
    const todo = await createTodo(owner);
    const nudge = await sendNudge(sender, owner, todo.id);
    await setCompleted(owner, todo.id, true);
    const notifier = ctx.module.get<NudgeNotifierPort>(NUDGE_NOTIFIER);
    vi.spyOn(notifier, "recordInteractions").mockRejectedValueOnce(
      new Error("감사 알림 저장 실패"),
    );

    // When
    await sendThanks(owner, todo.id, nudge.id).expect(500);

    // Then
    const stored = decodeRecord(
      "Nudge",
      requireRecord(
        await ctx.testDatabase
          .getClient()
          .orm.public.Nudge.where((row) => row.id.eq(nudge.id))
          .first(),
      ),
    );
    expect(stored.thankedAt).toBeNull();
    const retry = await sendThanks(owner, todo.id, nudge.id).expect(200);
    expect(retry.body.data.sentCount).toBe(1);
  });
});

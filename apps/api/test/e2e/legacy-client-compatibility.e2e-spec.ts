import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import request from "supertest";
import { z } from "zod";

import { notification } from "#api/platform/database/schema/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";

// 현재 validator를 가져오면 새 계약으로 구 클라이언트를 검증하게 되므로 소비 필드를 고정한다.
const legacyTodoSchema = z.object({
  id: z.number().int(),
  userId: z.cuid(),
  title: z.string(),
  content: z.string().nullable().optional(),
  completed: z.boolean(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.iso.datetime().nullable(),
  isAllDay: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const legacyTokensSchema = z.object({ accessToken: z.string(), refreshToken: z.string() });
const legacyPaginationSchema = z.object({
  nextCursor: z.number().int().nullable(),
  hasNext: z.boolean(),
  size: z.number(),
});
const legacyNotificationsSchema = z.object({
  notifications: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      body: z.string(),
      isRead: z.boolean(),
      createdAt: z.iso.datetime(),
      readAt: z.iso.datetime().nullable(),
    }),
  ),
  unreadCount: z.number().int(),
  hasMore: z.boolean(),
  nextCursor: z.number().int().nullable(),
});

function legacySuccess<T>(data: z.ZodType<T>) {
  return z.object({ success: z.literal(true), data, timestamp: z.number().int() });
}

const legacyErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
  timestamp: z.number().int(),
});

describe("배포된 구 클라이언트 HTTP 호환성", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  it.each(["1.7.x", "1.8.2", "1.9.0"])(
    "%s의 인증·할 일·날짜·커서·알림·오류 payload를 그대로 수용한다",
    async (clientVersion) => {
      // Given
      const email = `legacy-${clientVersion}@example.com`;
      const password = "Test1234!";
      const user = await testContext.helpers.createVerifiedUser(email, password);
      const login = await request(testContext.app.getHttpServer())
        .post("/v1/auth/login")
        .send({ email, password })
        .expect(200);
      const tokens = legacySuccess(legacyTokensSchema).parse(login.body).data;
      const refresh = await request(testContext.app.getHttpServer())
        .post("/v1/auth/refresh")
        .set("Authorization", `Bearer ${tokens.refreshToken}`)
        .expect(200);
      const refreshed = legacySuccess(legacyTokensSchema).parse(refresh.body).data;
      const authorization = `Bearer ${refreshed.accessToken}`;
      const categoryId = await testContext.helpers.getDefaultCategoryId(refreshed.accessToken);

      // When
      const created = await request(testContext.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", authorization)
        .send({ title: "구 앱의 할 일", categoryId, startDate: "2024-02-29" })
        .expect(201);

      // Then
      const todo = legacySuccess(z.object({ todo: legacyTodoSchema, message: z.string() })).parse(
        created.body,
      ).data.todo;
      expect(todo).toMatchObject({ startDate: "2024-02-29", scheduledTime: null, isAllDay: true });
      expect(todo).not.toHaveProperty("commentCount");

      // When
      const updated = await request(testContext.app.getHttpServer())
        .patch(`/v1/todos/${todo.id}`)
        .set("Authorization", authorization)
        .send({ startDate: "2024-02-29", scheduledTime: "09:30", isAllDay: false })
        .expect(200);

      // Then
      const scheduled = legacySuccess(
        z.object({ todo: legacyTodoSchema, message: z.string() }),
      ).parse(updated.body).data.todo;
      expect(scheduled.startDate).toBe("2024-02-29");
      expect(scheduled.scheduledTime).toMatch(/Z$/);

      // When
      const list = await request(testContext.app.getHttpServer())
        .get("/v1/todos")
        .set("Authorization", authorization)
        .query({
          size: "1",
          completed: "false",
          startDate: "2024-02-29",
          endDate: "2024-02-29",
        })
        .expect(200);

      // Then
      const page = legacySuccess(
        z.object({ items: z.array(legacyTodoSchema), pagination: legacyPaginationSchema }),
      ).parse(list.body).data;
      expect(page.items.map((item) => item.id)).toContain(todo.id);
      expect(page.pagination.size).toBe(1);

      // Given
      await testContext.testDatabase
        .getClient()
        .insert(notification)
        .values(
          ["첫 알림", "다음 알림"].map((title) => ({
            userId: user.userId,
            type: "SYSTEM_NOTICE" as const,
            title,
            body: title,
          })),
        );

      // When
      const notifications = await request(testContext.app.getHttpServer())
        .get("/v1/notifications")
        .set("Authorization", authorization)
        .query({ limit: "1" })
        .expect(200);

      // Then
      const firstPage = legacySuccess(legacyNotificationsSchema).parse(notifications.body).data;
      expect(firstPage.hasMore).toBe(true);

      // When
      const next = await request(testContext.app.getHttpServer())
        .get("/v1/notifications")
        .set("Authorization", authorization)
        .query({ limit: "1", cursor: String(firstPage.nextCursor) })
        .expect(200);

      // Then
      expect(
        legacySuccess(legacyNotificationsSchema).parse(next.body).data.notifications,
      ).toHaveLength(1);

      // When
      const invalid = await request(testContext.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", authorization)
        .send({ title: "잘못된 날짜", categoryId, startDate: "invalid-date" })
        .expect(400);

      // Then
      expect(legacyErrorSchema.parse(invalid.body).error.code).toBe(ErrorCode.SYS_0002);
    },
  );

  it("이전 1.9 댓글 payload와 읽기 응답을 유지한다", async () => {
    // Given
    const user = await testContext.helpers.createVerifiedUser(
      "legacy-comments@example.com",
      "Test1234!",
    );
    const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(testContext.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "댓글의 할 일", categoryId, startDate: "2024-02-29" })
      .expect(201);
    const todo = legacySuccess(z.object({ todo: legacyTodoSchema })).parse(created.body).data.todo;

    // When
    const written = await request(testContext.app.getHttpServer())
      .post(`/v1/todos/${todo.id}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId: null, items: [{ clientRequestId: randomUUID(), content: "이전 앱 댓글" }] })
      .expect(201);

    // Then
    const comments = legacySuccess(
      z.object({ comments: z.array(z.object({ id: z.string(), content: z.string() })) }),
    ).parse(written.body).data.comments;
    expect(comments[0]?.content).toBe("이전 앱 댓글");

    // When
    const conversation = await request(testContext.app.getHttpServer())
      .get(`/v1/todos/${todo.id}/conversation`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // Then
    const read = legacySuccess(
      z.object({
        items: z.array(z.object({ comment: z.object({ id: z.string(), content: z.string() }) })),
      }),
    ).parse(conversation.body).data;
    expect(read.items[0]?.comment.id).toBe(comments[0]?.id);
  });
});

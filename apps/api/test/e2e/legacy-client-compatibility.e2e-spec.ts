import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/errors";
import request from "supertest";
import { z } from "zod";

import { encodeCreate } from "#api/shared/infrastructure/database/database-records";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

// 현재 validator를 가져오면 새 계약으로 구 클라이언트를 검증하게 되므로 소비 필드를 고정한다.
const legacyTodoSchema = z.object({
  id: z.number().int(),
  userId: z.string().cuid(),
  title: z.string(),
  content: z.string().nullable().optional(),
  completed: z.boolean(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.string().datetime().nullable(),
  isAllDay: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
      createdAt: z.string().datetime(),
      readAt: z.string().datetime().nullable(),
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
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it.each(["1.7.x", "1.8.2", "1.9.0"])(
    "%s의 인증·할 일·날짜·커서·알림·오류 payload를 그대로 수용한다",
    async (clientVersion) => {
      const email = `legacy-${clientVersion}@example.com`;
      const password = "Test1234!";
      const user = await ctx.helpers.createVerifiedUser(email, password);
      const login = await request(ctx.app.getHttpServer())
        .post("/v1/auth/login")
        .send({ email, password })
        .expect(200);
      const tokens = legacySuccess(legacyTokensSchema).parse(login.body).data;
      const refresh = await request(ctx.app.getHttpServer())
        .post("/v1/auth/refresh")
        .set("Authorization", `Bearer ${tokens.refreshToken}`)
        .expect(200);
      const refreshed = legacySuccess(legacyTokensSchema).parse(refresh.body).data;
      const authorization = `Bearer ${refreshed.accessToken}`;
      const categoryId = await ctx.helpers.getDefaultCategoryId(refreshed.accessToken);

      const created = await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", authorization)
        .send({ title: "구 앱의 할 일", categoryId, startDate: "2024-02-29" })
        .expect(201);
      const todo = legacySuccess(z.object({ todo: legacyTodoSchema, message: z.string() })).parse(
        created.body,
      ).data.todo;
      expect(todo).toMatchObject({ startDate: "2024-02-29", scheduledTime: null, isAllDay: true });
      expect(todo).not.toHaveProperty("commentCount");

      const updated = await request(ctx.app.getHttpServer())
        .patch(`/v1/todos/${todo.id}`)
        .set("Authorization", authorization)
        .send({ startDate: "2024-02-29", scheduledTime: "09:30", isAllDay: false })
        .expect(200);
      const scheduled = legacySuccess(
        z.object({ todo: legacyTodoSchema, message: z.string() }),
      ).parse(updated.body).data.todo;
      expect(scheduled.startDate).toBe("2024-02-29");
      expect(scheduled.scheduledTime).toMatch(/Z$/);

      const list = await request(ctx.app.getHttpServer())
        .get("/v1/todos")
        .set("Authorization", authorization)
        .query({
          size: "1",
          completed: "false",
          startDate: "2024-02-29",
          endDate: "2024-02-29",
        })
        .expect(200);
      const page = legacySuccess(
        z.object({ items: z.array(legacyTodoSchema), pagination: legacyPaginationSchema }),
      ).parse(list.body).data;
      expect(page.items.map((item) => item.id)).toContain(todo.id);
      expect(page.pagination.size).toBe(1);

      await ctx.testDatabase.getClient().orm.public.Notification.createAndCount(
        ["첫 알림", "다음 알림"]
          .map(
            (title) =>
              ({
                userId: user.userId,
                type: "SYSTEM_NOTICE",
                title,
                body: title,
              }) satisfies Parameters<typeof encodeCreate<"Notification">>[1],
          )
          .map((value) => encodeCreate("Notification", value)),
      );
      const notifications = await request(ctx.app.getHttpServer())
        .get("/v1/notifications")
        .set("Authorization", authorization)
        .query({ limit: "1" })
        .expect(200);
      const firstPage = legacySuccess(legacyNotificationsSchema).parse(notifications.body).data;
      expect(firstPage.hasMore).toBe(true);
      const next = await request(ctx.app.getHttpServer())
        .get("/v1/notifications")
        .set("Authorization", authorization)
        .query({ limit: "1", cursor: String(firstPage.nextCursor) })
        .expect(200);
      expect(
        legacySuccess(legacyNotificationsSchema).parse(next.body).data.notifications,
      ).toHaveLength(1);

      const invalid = await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", authorization)
        .send({ title: "잘못된 날짜", categoryId, startDate: "invalid-date" })
        .expect(400);
      expect(legacyErrorSchema.parse(invalid.body).error.code).toBe(ErrorCode.SYS_0002);
    },
  );

  it("이전 1.9 댓글 payload와 읽기 응답을 유지한다", async () => {
    const user = await ctx.helpers.createVerifiedUser("legacy-comments@example.com", "Test1234!");
    const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "댓글의 할 일", categoryId, startDate: "2024-02-29" })
      .expect(201);
    const todo = legacySuccess(z.object({ todo: legacyTodoSchema })).parse(created.body).data.todo;
    const written = await request(ctx.app.getHttpServer())
      .post(`/v1/todos/${todo.id}/comments`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ parentId: null, items: [{ clientRequestId: randomUUID(), content: "이전 앱 댓글" }] })
      .expect(201);
    const comments = legacySuccess(
      z.object({ comments: z.array(z.object({ id: z.string(), content: z.string() })) }),
    ).parse(written.body).data.comments;
    expect(comments[0]?.content).toBe("이전 앱 댓글");
    const conversation = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${todo.id}/conversation`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const read = legacySuccess(
      z.object({
        items: z.array(z.object({ comment: z.object({ id: z.string(), content: z.string() }) })),
      }),
    ).parse(conversation.body).data;
    expect(read.items[0]?.comment.id).toBe(comments[0]?.id);
  });
});

import { randomUUID } from "node:crypto";

import { createTodoResponseSchema } from "@aido/api";
import request from "supertest";

import { TODO_COMMENT_THROTTLE } from "#api/modules/engagement/comments/presentation/http/v1/todo-comment.controller";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("할 일 댓글 작성 요청 제한 E2E (실제 throttler, 직렬 실행)", () => {
  let ctx: E2eTestContext;
  const limit = TODO_COMMENT_THROTTLE.WRITE.default.limit;

  beforeAll(async () => {
    ctx = await createE2eApp({ withRealThrottler: true });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("같은 사용자는 분당 30회까지 댓글을 쓰고 31번째는 SYS_0001 429다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("comment-throttle@test.com", "Test1234!");
    const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "요청 제한", categoryId, startDate: "2026-08-14" })
      .expect(201);
    const todoId = createTodoResponseSchema.parse(created.body.data).todo.id;
    const write = () =>
      request(ctx.app.getHttpServer())
        .post(`/v1/todos/${todoId}/comments`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ parentId: null, items: [{ clientRequestId: randomUUID(), content: "댓글" }] });
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await write()).status).toBe(201);
    }

    // When
    const throttled = await write();

    // Then
    expect(limit).toBe(30);
    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe("SYS_0001");
  });
});

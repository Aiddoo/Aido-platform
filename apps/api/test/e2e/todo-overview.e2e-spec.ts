import { createTodoResponseSchema, todoOverviewResponseSchema } from "@aido/api";
import { successEnvelopeSchema } from "@aido/api/common";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { todayIn } from "#test/fixtures/clock.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const TIMEZONE = "Asia/Seoul";

describe("할 일 개요 E2E (GET /v1/todos/overview)", () => {
  let ctx: E2eTestContext;
  let accessToken: string;
  let categoryId: number;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    const user = await ctx.helpers.createVerifiedUser("todo-overview@test.com", "Test1234!");
    accessToken = user.accessToken;
    categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  async function getOverview() {
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/todos/overview")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    successEnvelopeSchema.parse(response.body);
    return todoOverviewResponseSchema.parse(response.body.data);
  }

  async function createTodo(body: object) {
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", TIMEZONE)
      .send({ title: "물 마시기", categoryId, ...body })
      .expect(201);
    return createTodoResponseSchema.parse(response.body.data);
  }

  it("할 일이 없는 새 계정은 셋 다 false다", async () => {
    // When
    const overview = await getOverview();

    // Then
    expect(overview).toEqual({ hasTodo: false, hasCompletedTodo: false, hasActiveRepeat: false });
  });

  it("끝나지 않은 반복을 만들고 한 회차를 끝내면 셋 다 true다", async () => {
    // Given
    const { todo } = await createTodo({
      startDate: todayIn(TIMEZONE).toString(),
      repeat: { frequency: "DAILY", end: { type: "NEVER" } },
    });
    await request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${todo.id}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ completed: true })
      .expect(200);

    // When
    const overview = await getOverview();

    // Then
    expect(overview).toEqual({ hasTodo: true, hasCompletedTodo: true, hasActiveRepeat: true });
  });

  it("미리 만드는 기간 안에서 끝나는 반복은 회차가 모두 보여 진행 중이 아니다", async () => {
    // Given
    const today = todayIn(TIMEZONE);
    await createTodo({
      startDate: today.toString(),
      repeat: {
        frequency: "DAILY",
        end: { type: "UNTIL", date: today.add({ days: 6 }).toString() },
      },
    });

    // When
    const overview = await getOverview();

    // Then
    expect(overview).toEqual({ hasTodo: true, hasCompletedTodo: false, hasActiveRepeat: false });
  });

  it("토큰이 없으면 401이다", async () => {
    // When
    const response = await request(ctx.app.getHttpServer()).get("/v1/todos/overview");

    // Then
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_0101);
  });
});

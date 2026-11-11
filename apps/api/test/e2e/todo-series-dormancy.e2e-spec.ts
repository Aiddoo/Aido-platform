import { todoListResponseSchema, todoSummaryResponseSchema } from "@aido/api";
import { eq } from "drizzle-orm";
import request from "supertest";

import { todo, todoSeries, user as userTable } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { releasedTodoSchema } from "./fixtures/released-todo-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateAfter(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

describe("반복 할 일 복귀 E2E", () => {
  let ctx: E2eTestContext;
  let accessToken: string;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    const user = await ctx.helpers.createVerifiedUser("dormant@example.com", "Test1234!");
    accessToken = user.accessToken;
    userId = user.userId;
    categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  /** 자리 비운 사이 커서가 멈춘 규칙. 헤더 없는 구버전 앱처럼 UTC 규칙으로 만든다. */
  async function seedAwaySeries() {
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "물 마시기",
        categoryId,
        startDate: dateAfter(0),
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      })
      .expect(201);
    const seriesId: string = response.body.data.series.id;
    const lastMovedAt = new Date(Date.now() - 200 * DAY_MS);
    await ctx.testDatabase.getClient().delete(todo).where(eq(todo.seriesId, seriesId));
    await ctx.testDatabase
      .getClient()
      .update(todoSeries)
      .set({
        startDate: Temporal.PlainDate.from(dateAfter(-300)),
        nextOccurrenceDate: Temporal.PlainDate.from(dateAfter(-110)),
        generatedCount: 190,
        updatedAt: instantFromDate(lastMovedAt),
      })
      .where(eq(todoSeries.id, seriesId));
    await ctx.testDatabase
      .getClient()
      .update(userTable)
      .set({ lastActiveAt: instantFromDate(lastMovedAt) })
      .where(eq(userTable.id, userId));
    return seriesId;
  }

  it("앱 헤더가 없는 구버전 앱의 첫 오늘 목록에 오늘 회차가 있고 지난 날은 없다", async () => {
    // Given
    const seriesId = await seedAwaySeries();
    // When
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ startDate: dateAfter(0), endDate: dateAfter(0) })
      .expect(200);
    // Then
    const { items } = todoListResponseSchema.parse(response.body.data);
    expect(items.map((item) => item.title)).toEqual(["물 마시기"]);
    expect(releasedTodoSchema.safeParse(response.body.data.items[0]).success).toBe(true);
    const rows = await ctx.testDatabase
      .getClient()
      .select({ occurrenceDate: todo.occurrenceDate })
      .from(todo)
      .where(eq(todo.seriesId, seriesId))
      .orderBy(todo.occurrenceDate);
    expect(rows).toHaveLength(91);
    expect(rows[0]?.occurrenceDate?.toString()).toBe(dateAfter(0));
  });

  it("같이 불리는 요약에도 오늘 회차가 잡힌다", async () => {
    // Given
    await seedAwaySeries();
    // When
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/todos/summary")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // Then
    expect(todoSummaryResponseSchema.parse(response.body.data).totalTodos).toBe(1);
  });

  it("두 기기가 동시에 열어도 회차가 중복되지 않는다", async () => {
    // Given
    const seriesId = await seedAwaySeries();
    const open = () =>
      request(ctx.app.getHttpServer())
        .get("/v1/todos")
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ startDate: dateAfter(0), endDate: dateAfter(0) })
        .expect(200);
    // When
    const responses = await Promise.all([open(), open()]);
    // Then
    for (const response of responses) {
      expect(todoListResponseSchema.parse(response.body.data).items).toHaveLength(1);
    }
    expect(await ctx.testDatabase.getClient().$count(todo, eq(todo.seriesId, seriesId))).toBe(91);
  });

  it.each([
    { name: "정지", patch: { status: "SUSPENDED" as const } },
    { name: "탈퇴 대기", patch: { deletedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()) } },
  ])("$name 계정은 세션이 살아 있어도 회차를 만들지 않는다", async ({ patch }) => {
    // Given
    const seriesId = await seedAwaySeries();
    await ctx.testDatabase.getClient().update(userTable).set(patch).where(eq(userTable.id, userId));
    // When
    await request(ctx.app.getHttpServer())
      .get("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`);
    // Then
    expect(await ctx.testDatabase.getClient().$count(todo, eq(todo.seriesId, seriesId))).toBe(0);
  });
});

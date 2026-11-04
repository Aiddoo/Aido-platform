import { createTodoResponseSchema, todoSeriesResponseSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { eq, sql } from "drizzle-orm";
import request from "supertest";

import { AI_GENERATOR } from "#api/modules/ai-assistance/ai-assistance-generation.public";
import { createEntityId } from "#api/platform/database/entity-id";
import { memo, todoSeries, user as userTable } from "#api/platform/database/schema/index";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";

import {
  releasedConvertMemoToTodosResponseSchema,
  releasedCreateRecurringTodoResponseSchema,
  releasedCreateTodoResponseSchema,
  releasedDeleteTodoResponseSchema,
  releasedParsedTodoSchema,
} from "./fixtures/released-todo-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateAfter(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

describe("반복 할 일 생성 E2E", () => {
  let ctx: E2eTestContext;
  let fakeAiGenerator: FakeAiGenerator;
  let accessToken: string;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    fakeAiGenerator = new FakeAiGenerator();
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(AI_GENERATOR).useValue(fakeAiGenerator),
      additionalResetters: [() => fakeAiGenerator.clear()],
    });
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    const user = await ctx.helpers.createVerifiedUser("series@example.com", "Test1234!");
    accessToken = user.accessToken;
    userId = user.userId;
    categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  function post(path: string, body: object, token = accessToken) {
    return request(ctx.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Timezone", "Asia/Seoul")
      .send(body);
  }

  describe("POST /v1/todos repeat", () => {
    it("규칙과 첫 회차를 공유 계약 그대로 돌려주고 90일 치 회차를 만든다", async () => {
      // Given
      const startDate = dateAfter(1);
      // When
      const response = await post("/v1/todos", {
        title: "물 마시기",
        categoryId,
        startDate,
        scheduledTime: "09:00",
        isAllDay: false,
        items: [{ title: "한 컵" }],
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      }).expect(201);
      // Then
      const body = createTodoResponseSchema.parse(response.body.data);
      expect(body.todo).toMatchObject({ startDate, isAllDay: false, title: "물 마시기" });
      expect(body.todo.recurrenceGroupId).toBe(body.series?.id);
      expect(body.series).toMatchObject({
        scheduledTime: "09:00",
        timezone: "Asia/Seoul",
        isActive: true,
        checklist: [{ title: "한 컵" }],
      });
      expect(todoSeriesResponseSchema.safeParse(body.series).success).toBe(true);
      const rows = await ctx.testDatabase
        .getClient()
        .query.todo.findMany({ where: { userId, title: "물 마시기" } });
      expect(rows.length).toBeGreaterThanOrEqual(TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS - 1);
      expect(rows.length).toBeLessThanOrEqual(TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS + 1);
    });

    it.each([
      {
        name: "맞는 날짜가 없음",
        body: () => ({
          startDate: dateAfter(5),
          repeat: { frequency: "DAILY", end: { type: "UNTIL", date: dateAfter(1) } },
        }),
        status: 400,
        code: ErrorCode.TODO_0843,
      },
      {
        name: "반복과 기간 종료일을 함께",
        body: () => ({
          startDate: dateAfter(1),
          endDate: dateAfter(3),
          repeat: { frequency: "DAILY", end: { type: "NEVER" } },
        }),
        status: 400,
        code: ErrorCode.TODO_0845,
      },
      {
        name: "간격 3",
        body: () => ({
          startDate: dateAfter(1),
          repeat: { frequency: "WEEKLY", interval: 3, weekdays: ["MON"], end: { type: "NEVER" } },
        }),
        status: 400,
        code: ErrorCode.SYS_0002,
      },
      {
        name: "횟수 366",
        body: () => ({
          startDate: dateAfter(1),
          repeat: { frequency: "DAILY", end: { type: "COUNT", count: 366 } },
        }),
        status: 400,
        code: ErrorCode.SYS_0002,
      },
    ])("$name이면 $code다", async ({ body, status, code }) => {
      // When
      const response = await post("/v1/todos", { title: "잘못된 반복", categoryId, ...body() });
      // Then
      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
    });

    it.each([
      { tier: "FREE", patch: {} },
      { tier: "PREMIUM", patch: { subscriptionStatus: "ACTIVE" } },
      { tier: "ADMIN", patch: { role: "ADMIN" } },
    ] as const)("$tier도 진행 중 반복 30개 상한이 같다", async ({ patch }) => {
      // Given
      const client = ctx.testDatabase.getClient();
      if (Object.keys(patch).length > 0) {
        await client.update(userTable).set(patch).where(eq(userTable.id, userId));
      }
      await client.insert(todoSeries).values(
        Array.from({ length: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER }, () => ({
          id: createEntityId(),
          userId,
          categoryId,
          title: "시드",
          timezone: "UTC",
          repeatFrequency: "DAILY" as const,
          startDate: new Date(),
          nextOccurrenceDate: new Date(),
          sortOrder: 0,
        })),
      );
      // When
      const response = await post("/v1/todos", {
        title: "초과",
        categoryId,
        startDate: dateAfter(1),
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      });
      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(ErrorCode.TODO_0842);
    });
  });

  describe("출시 앱 요청 모양", () => {
    it("POST /v1/todos는 repeat 없이 지금과 같고 series 키가 없다", async () => {
      // Given
      const startDate = dateAfter(1);
      // When
      const response = await post("/v1/todos", {
        title: "단일",
        categoryId,
        startDate,
        isAllDay: true,
      }).expect(201);
      // Then
      const body = releasedCreateTodoResponseSchema.parse(response.body.data);
      expect(body.todo).toMatchObject({ startDate, recurrenceGroupId: null, isAllDay: true });
      expect(response.body.data).not.toHaveProperty("series");
      const series = await ctx.testDatabase.getClient().query.todoSeries.findMany({
        where: { userId },
      });
      expect(series).toEqual([]);
    });

    it("POST /v1/todos에 종일 기본값과 시간을 함께 보내면 시간 일정으로 맞춘다", async () => {
      // When
      const response = await post("/v1/todos", {
        title: "시간",
        categoryId,
        startDate: dateAfter(1),
        scheduledTime: "10:00",
      }).expect(201);
      // Then
      const body = releasedCreateTodoResponseSchema.parse(response.body.data);
      expect(body.todo.isAllDay).toBe(false);
      expect(body.todo.scheduledTime).not.toBeNull();
    });

    it("POST /v1/todos/recurring은 201이고 count는 이번에 만든 행 수다", async () => {
      // Given
      const startDate = dateAfter(1);
      // When
      const response = await post("/v1/todos/recurring", {
        title: "출시 앱 반복",
        categoryId,
        startDate,
        endDate: dateAfter(14),
        daysOfWeek: ["MON", "WED", "FRI"],
      }).expect(201);
      // Then
      const body = releasedCreateRecurringTodoResponseSchema.parse(response.body.data);
      expect(body.count).toBe(body.todos.length);
      expect(body.count).toBeGreaterThan(0);
      expect(new Set(body.todos.map((todo) => todo.recurrenceGroupId)).size).toBe(1);
      expect(response.body.data).not.toHaveProperty("series");
    });

    it("POST /v1/todos/recurring은 이전에 TODO_0812이던 100개 초과 요청도 성공한다", async () => {
      // When
      const response = await post("/v1/todos/recurring", {
        title: "긴 반복",
        categoryId,
        startDate: dateAfter(1),
        endDate: dateAfter(300),
        daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      }).expect(201);
      // Then
      const body = releasedCreateRecurringTodoResponseSchema.parse(response.body.data);
      expect(body.count).toBeLessThanOrEqual(TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS + 1);
      const [series] = await ctx.testDatabase.getClient().query.todoSeries.findMany({
        where: { userId },
      });
      expect(series?.nextOccurrenceDate).not.toBeNull();
    });

    it("POST /v1/todos/recurring의 366일 검증은 그대로다", async () => {
      // When
      const response = await post("/v1/todos/recurring", {
        title: "너무 긴 반복",
        categoryId,
        startDate: dateAfter(0),
        endDate: dateAfter(400),
        daysOfWeek: ["MON"],
      });
      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
    });

    it("POST /v1/todos/recurring은 카테고리가 가득 차면 계속 TODO_0813이다", async () => {
      // Given
      await ctx.testDatabase.getClient().execute(
        sql`INSERT INTO "Todo" ("userId","categoryId","title","startDate","updatedAt")
            SELECT ${userId}, ${categoryId}, 'seed', now(), now()
            FROM generate_series(1, ${TODO_LIMITS.MAX_PER_CATEGORY})`,
      );
      // When
      const response = await post("/v1/todos/recurring", {
        title: "초과",
        categoryId,
        startDate: dateAfter(1),
        endDate: dateAfter(8),
        daysOfWeek: ["MON"],
      });
      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(ErrorCode.TODO_0813);
    });

    it("DELETE /v1/todos/:id는 범위 없이 그 회차만 지운다", async () => {
      // Given
      const created = await post("/v1/todos/recurring", {
        title: "지울 반복",
        categoryId,
        startDate: dateAfter(1),
        endDate: dateAfter(8),
        daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      }).expect(201);
      const { todos, count } = releasedCreateRecurringTodoResponseSchema.parse(created.body.data);
      // When
      const response = await request(ctx.app.getHttpServer())
        .delete(`/v1/todos/${todos[0]?.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      // Then
      releasedDeleteTodoResponseSchema.parse(response.body.data);
      const rows = await ctx.testDatabase
        .getClient()
        .query.todo.findMany({ where: { userId, title: "지울 반복" } });
      expect(rows).toHaveLength(count - 1);
    });

    it("메모 변환은 isRecurring + recurrence로 보내도 반복 회차를 만든다", async () => {
      // Given
      const [seeded] = await ctx.testDatabase
        .getClient()
        .insert(memo)
        .values({ userId, content: "운동", sortOrder: 0 })
        .returning();
      const startDate = dateAfter(1);
      // When
      const response = await post(`/v1/memos/${seeded?.id}/convert-to-todos`, {
        todos: [
          {
            title: "운동",
            categoryId,
            startDate,
            isRecurring: true,
            recurrence: {
              daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
              endDate: dateAfter(3),
            },
          },
        ],
      }).expect(201);
      // Then
      const body = releasedConvertMemoToTodosResponseSchema.parse(response.body.data);
      expect(body.todos.map((todo) => todo.startDate)).toEqual([
        startDate,
        dateAfter(2),
        dateAfter(3),
      ]);
      expect(body.todos.every((todo) => todo.recurrenceGroupId != null)).toBe(true);
    });

    it("parse-todo는 recurrence를 그대로 두고 새 repeat만 더한다", async () => {
      // Given
      fakeAiGenerator.setRawResponse({
        intent: "TASK",
        title: "러닝",
        date: { kind: "NONE" },
        time: null,
        repeat: { pattern: "WEEKLY_DAYS", daysOfWeek: ["MON", "WED"] },
      });
      // When
      const response = await post("/v1/ai/parse-todo", { text: "매주 월수 러닝" }).expect(200);
      // Then
      const parsed = releasedParsedTodoSchema.parse(response.body.data.data);
      expect(parsed).toMatchObject({
        isRecurring: true,
        recurrence: { daysOfWeek: ["MON", "WED"], endDate: expect.any(String) },
      });
      expect(response.body.data.data.repeat).toEqual({
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "WED"],
        end: { type: "NEVER" },
      });
    });
  });
});

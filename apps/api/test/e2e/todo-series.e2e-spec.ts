import {
  createTodoResponseSchema,
  deleteTodoResponseSchema,
  todoSeriesResponseSchema,
  updateTodoResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { eq, sql } from "drizzle-orm";
import request from "supertest";

import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { createEntityId } from "#api/platform/database/entity-id";
import { memo, todo, todoSeries, user as userTable } from "#api/platform/database/schema/index";
import { nowInstant, todayUtc } from "#test/fixtures/clock.fixture";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";

import {
  releasedConvertMemoToTodosResponseSchema,
  releasedCreateRecurringTodoResponseSchema,
  releasedCreateTodoResponseSchema,
  releasedDeleteTodoResponseSchema,
  releasedParsedTodoSchema,
} from "./fixtures/released-todo-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

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
        builder.overrideProvider(AiGeneratorPort).useValue(fakeAiGenerator),
      additionalResetters: [() => fakeAiGenerator.clear()],
    });
  }, 60_000);

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
        Array.from({ length: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER }, () => {
          const id = createEntityId();
          return {
            id,
            originSeriesId: id,
            userId,
            categoryId,
            title: "시드",
            timezone: "UTC",
            repeatFrequency: "DAILY" as const,
            startDate: todayUtc(),
            nextOccurrenceDate: todayUtc(),
            updatedAt: nowInstant(),
          };
        }),
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

  describe("범위 수정·삭제·규칙 조회", () => {
    async function createSeries() {
      const response = await post("/v1/todos", {
        title: "회차",
        categoryId,
        startDate: dateAfter(1),
        repeat: { frequency: "DAILY", end: { type: "COUNT", count: 4 } },
      }).expect(201);
      const body = createTodoResponseSchema.parse(response.body.data);
      const seriesId = body.series?.id ?? "";
      const rows = await ctx.testDatabase.getClient().query.todo.findMany({
        where: { seriesId },
        orderBy: { occurrenceDate: "asc" },
      });
      return { seriesId, ids: rows.map((row) => row.id) };
    }

    function patch(id: number, body: object) {
      return request(ctx.app.getHttpServer())
        .patch(`/v1/todos/${id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send(body);
    }

    function remove(id: number, query = "") {
      return request(ctx.app.getHttpServer())
        .delete(`/v1/todos/${id}${query}`)
        .set("Authorization", `Bearer ${accessToken}`);
    }

    it("THIS_AND_FOLLOWING은 공유 응답으로 이후 회차를 고친다", async () => {
      // Given
      const { ids } = await createSeries();
      // When
      const response = await patch(ids[1] ?? 0, {
        scope: "THIS_AND_FOLLOWING",
        title: "이후 수정",
      }).expect(200);
      // Then
      const body = updateTodoResponseSchema.parse(response.body.data);
      expect(body.todo.title).toBe("이후 수정");
      const rows = await ctx.testDatabase.getClient().query.todo.findMany({
        where: { id: { in: ids } },
        orderBy: { occurrenceDate: "asc" },
      });
      expect(rows.map((row) => row.title)).toEqual(["회차", "이후 수정", "이후 수정", "이후 수정"]);
    });

    it("scope와 날짜를 함께 보내면 날짜는 이 회차에만 적용한다", async () => {
      // Given
      const { ids } = await createSeries();
      const moved = dateAfter(30);
      // When
      const response = await patch(ids[1] ?? 0, {
        scope: "THIS_AND_FOLLOWING",
        title: "함께",
        startDate: moved,
      }).expect(200);
      // Then
      expect(updateTodoResponseSchema.parse(response.body.data).todo.startDate).toBe(moved);
      const other = await ctx.testDatabase.getClient().query.todo.findFirst({
        where: { id: ids[2] },
      });
      expect(other?.title).toBe("함께");
      expect(other?.startDate.toString()).not.toBe(moved);
    });

    it("단일 할 일에 repeat를 주면 반복으로 전환하고 null을 주면 끝낸다", async () => {
      // Given
      const created = await post("/v1/todos", {
        title: "단일",
        categoryId,
        startDate: dateAfter(1),
      }).expect(201);
      const single = createTodoResponseSchema.parse(created.body.data).todo;
      // When
      const converted = await patch(single.id, {
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      }).expect(200);
      const stopped = await patch(single.id, { repeat: null }).expect(200);
      const again = await patch(single.id, { repeat: null });
      // Then
      const seriesId = updateTodoResponseSchema.parse(converted.body.data).todo.recurrenceGroupId;
      expect(seriesId).toEqual(expect.any(String));
      updateTodoResponseSchema.parse(stopped.body.data);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe(ErrorCode.TODO_0846);
      const series = await request(ctx.app.getHttpServer())
        .get(`/v1/todo-series/${seriesId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(todoSeriesResponseSchema.parse(series.body.data)).toMatchObject({
        isActive: false,
        nextOccurrenceDate: null,
      });
    });

    it.each([
      {
        name: "PATCH THIS_AND_FOLLOWING",
        call: (id: number) => patch(id, { scope: "THIS_AND_FOLLOWING", title: "x" }),
      },
      {
        name: "PATCH THIS_ONLY",
        call: (id: number) => patch(id, { scope: "THIS_ONLY", title: "x" }),
      },
      { name: "PATCH repeat null", call: (id: number) => patch(id, { repeat: null }) },
      { name: "DELETE ALL", call: (id: number) => remove(id, "?scope=ALL") },
    ])("반복이 아닌 할 일에 $name이면 TODO_0844다", async ({ call }) => {
      // Given
      const created = await post("/v1/todos", {
        title: "단일",
        categoryId,
        startDate: dateAfter(1),
      }).expect(201);
      const { todo } = createTodoResponseSchema.parse(created.body.data);
      // When
      const response = await call(todo.id);
      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCode.TODO_0844);
    });

    it.each([
      {
        name: "범위 없이 규칙",
        body: { repeat: { frequency: "DAILY", end: { type: "NEVER" } } },
        field: "scope",
      },
      {
        name: "이 할 일만에 체크리스트",
        body: { scope: "THIS_ONLY", checklist: [{ title: "x" }] },
        field: "checklist",
      },
    ])("회차에 $name이면 TODO_0845다", async ({ body }) => {
      // Given
      const { ids } = await createSeries();
      // When
      const response = await patch(ids[0] ?? 0, body);
      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCode.TODO_0845);
    });

    it("잘못된 scope는 입력 검증에서 거부한다", async () => {
      // Given
      const { ids } = await createSeries();
      // When
      const patched = await patch(ids[0] ?? 0, { scope: "ALL" });
      const removed = await remove(ids[0] ?? 0, "?scope=SOME");
      // Then
      expect(patched.status).toBe(400);
      expect(patched.body.error.code).toBe(ErrorCode.SYS_0002);
      expect(removed.status).toBe(400);
    });

    it("DELETE scope=ALL은 공유 응답으로 규칙과 회차를 지운다", async () => {
      // Given
      const { seriesId, ids } = await createSeries();
      // When
      const response = await remove(ids[1] ?? 0, "?scope=ALL").expect(200);
      const series = await request(ctx.app.getHttpServer())
        .get(`/v1/todo-series/${seriesId}`)
        .set("Authorization", `Bearer ${accessToken}`);
      // Then
      deleteTodoResponseSchema.parse(response.body.data);
      expect(series.status).toBe(404);
      expect(series.body.error.code).toBe(ErrorCode.TODO_0841);
    });

    it("다른 사용자의 규칙은 조회할 수 없다", async () => {
      // Given
      const { seriesId } = await createSeries();
      const other = await ctx.helpers.createVerifiedUser("series-other@example.com", "Test1234!");
      // When
      const response = await request(ctx.app.getHttpServer())
        .get(`/v1/todo-series/${seriesId}`)
        .set("Authorization", `Bearer ${other.accessToken}`);
      // Then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(ErrorCode.TODO_0841);
    });

    it("인증 없이는 규칙을 조회할 수 없다", async () => {
      // When
      const response = await request(ctx.app.getHttpServer()).get("/v1/todo-series/any");
      // Then
      expect(response.status).toBe(401);
    });

    it("출시 앱의 PATCH는 범위 없이 그 회차만 고친다", async () => {
      // Given
      const { ids } = await createSeries();
      // When
      const response = await patch(ids[1] ?? 0, { title: "이 회차만" }).expect(200);
      // Then
      expect(releasedCreateTodoResponseSchema.parse(response.body.data).todo.title).toBe(
        "이 회차만",
      );
      const other = await ctx.testDatabase
        .getClient()
        .query.todo.findFirst({ where: { id: ids[2] } });
      expect(other?.title).toBe("회차");
    });

    it("규칙을 지운 뒤 남은 출시 앱 묶음(규칙 없는 옛 행)도 범위 없이 수정·삭제된다", async () => {
      // Given
      const { seriesId, ids } = await createSeries();
      await ctx.testDatabase.getClient().delete(todoSeries).where(eq(todoSeries.id, seriesId));
      // When
      const patched = await patch(ids[0] ?? 0, { title: "고아" });
      const removed = await remove(ids[1] ?? 0);
      const following = await patch(ids[2] ?? 0, { scope: "THIS_AND_FOLLOWING", title: "x" });
      // Then
      expect(patched.status).toBe(200);
      expect(removed.status).toBe(200);
      expect(following.status).toBe(404);
      expect(following.body.error.code).toBe(ErrorCode.TODO_0841);
    });
  });

  describe("규칙 없는 묶음 (1.14.2로 되돌린 동안 생긴 것)", () => {
    async function seedRuleless() {
      const created = await post("/v1/todos", {
        title: "옛 묶음",
        categoryId,
        startDate: dateAfter(1),
        repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
      }).expect(201);
      const seriesId = createTodoResponseSchema.parse(created.body.data).series?.id ?? "";
      const client = ctx.testDatabase.getClient();
      await client.delete(todoSeries).where(eq(todoSeries.id, seriesId));
      await client.update(todo).set({ occurrenceDate: null }).where(eq(todo.seriesId, seriesId));
      const rows = await client.query.todo.findMany({ where: { seriesId } });
      return { seriesId, ids: rows.map((row) => row.id) };
    }

    function remove(id: number, scope?: string) {
      return request(ctx.app.getHttpServer())
        .delete(`/v1/todos/${id}`)
        .query(scope == null ? {} : { scope })
        .set("Authorization", `Bearer ${accessToken}`);
    }

    it("scope=ALL은 200이고 그 묶음만 지운다", async () => {
      // Given
      const { seriesId, ids } = await seedRuleless();
      const other = await seedRuleless();
      // When
      const response = await remove(ids[1] ?? 0, "ALL");
      // Then
      expect(response.status).toBe(200);
      const client = ctx.testDatabase.getClient();
      expect(await client.query.todo.findMany({ where: { seriesId } })).toEqual([]);
      expect(
        await client.query.todo.findMany({ where: { seriesId: other.seriesId } }),
      ).toHaveLength(3);
    });

    it("scope=THIS_AND_FOLLOWING은 TODO_0844이고 이 할 일만은 지운다", async () => {
      // Given
      const { ids } = await seedRuleless();
      // When
      const following = await remove(ids[0] ?? 0, "THIS_AND_FOLLOWING");
      const thisOnly = await remove(ids[0] ?? 0, "THIS_ONLY");
      // Then
      expect(following.status).toBe(400);
      expect(following.body.error.code).toBe(ErrorCode.TODO_0844);
      expect(thisOnly.status).toBe(200);
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

    it("POST /v1/todos/recurring은 해당 날짜가 없으면 옛 코드 SYS_0002다", async () => {
      // Given
      const sunday = "2027-01-03";
      // When
      const response = await post("/v1/todos/recurring", {
        title: "없는 요일",
        categoryId,
        startDate: sunday,
        endDate: sunday,
        daysOfWeek: ["MON"],
      });
      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
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

    const seedActiveSeries = (count: number) =>
      ctx.testDatabase
        .getClient()
        .insert(todoSeries)
        .values(
          Array.from({ length: count }, () => {
            const id = createEntityId();
            return {
              id,
              originSeriesId: id,
              userId,
              categoryId,
              title: "시드",
              timezone: "UTC",
              repeatFrequency: "DAILY" as const,
              startDate: todayUtc(),
              nextOccurrenceDate: todayUtc(),
              updatedAt: nowInstant(),
            };
          }),
        );

    describe("옛 경로 상한까지 찬 사용자", () => {
      beforeEach(async () => {
        await seedActiveSeries(TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY);
      });

      it("POST /v1/todos/recurring은 옛 앱이 아는 TODO_0813으로 거절한다", async () => {
        // When
        const response = await post("/v1/todos/recurring", {
          title: "옛 앱 반복",
          categoryId,
          startDate: dateAfter(1),
          endDate: dateAfter(8),
          daysOfWeek: ["MON"],
        });
        // Then
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe(ErrorCode.TODO_0813);
      });

      it("출시 앱의 메모 변환(isRecurring)도 TODO_0813으로 거절하고 메모를 지키며 제목을 남기지 않는다", async () => {
        // Given
        const created = await ctx.testDatabase
          .getClient()
          .insert(memo)
          .values({ userId, content: "메모", sortOrder: 0, updatedAt: Temporal.Now.instant() })
          .returning();
        // When
        const response = await post(`/v1/memos/${created[0]?.id}/convert-to-todos`, {
          todos: [
            {
              title: "옛 앱 메모 반복",
              categoryId,
              startDate: dateAfter(1),
              isRecurring: true,
              recurrence: { daysOfWeek: ["MON"], endDate: dateAfter(8) },
            },
          ],
        });
        // Then
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe(ErrorCode.TODO_0813);
        const memoRow = await ctx.testDatabase
          .getClient()
          .query.memo.findFirst({ where: { id: created[0]?.id ?? 0 } });
        expect(memoRow).toBeDefined();
      });
    });

    describe("진행 중 반복이 상한에 찬 사용자", () => {
      beforeEach(async () => {
        await seedActiveSeries(TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER);
      });

      it("POST /v1/todos/recurring은 옛 서버처럼 만든다", async () => {
        // When
        const response = await post("/v1/todos/recurring", {
          title: "옛 앱 반복",
          categoryId,
          startDate: dateAfter(1),
          endDate: dateAfter(8),
          daysOfWeek: ["MON"],
        });
        // Then
        expect(response.status).toBe(201);
        releasedCreateRecurringTodoResponseSchema.parse(response.body.data);
      });

      it("출시 앱의 메모 변환(isRecurring)도 옛 서버처럼 만든다", async () => {
        // Given
        const created = await ctx.testDatabase
          .getClient()
          .insert(memo)
          .values({ userId, content: "메모", sortOrder: 0, updatedAt: Temporal.Now.instant() })
          .returning();
        // When
        const response = await post(`/v1/memos/${created[0]?.id}/convert-to-todos`, {
          todos: [
            {
              title: "옛 앱 메모 반복",
              categoryId,
              startDate: dateAfter(1),
              isRecurring: true,
              recurrence: { daysOfWeek: ["MON"], endDate: dateAfter(8) },
            },
          ],
        });
        // Then
        expect(response.status).toBe(201);
      });

      it("메모 변환의 새 repeat는 계속 TODO_0842다", async () => {
        // Given
        const created = await ctx.testDatabase
          .getClient()
          .insert(memo)
          .values({ userId, content: "메모", sortOrder: 0, updatedAt: Temporal.Now.instant() })
          .returning();
        // When
        const response = await post(`/v1/memos/${created[0]?.id}/convert-to-todos`, {
          todos: [
            {
              title: "새 앱 메모 반복",
              categoryId,
              startDate: dateAfter(1),
              repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
            },
          ],
        });
        // Then
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe(ErrorCode.TODO_0842);
      });

      it("새 앱의 repeat는 계속 TODO_0842다", async () => {
        // When
        const response = await post("/v1/todos", {
          title: "새 앱 반복",
          categoryId,
          startDate: dateAfter(1),
          repeat: {
            frequency: "WEEKLY",
            interval: 1,
            weekdays: ["MON"],
            end: { type: "UNTIL", date: dateAfter(8) },
          },
        });
        // Then
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe(ErrorCode.TODO_0842);
      });
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
        .values({ userId, content: "운동", sortOrder: 0, updatedAt: Temporal.Now.instant() })
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

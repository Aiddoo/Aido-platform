import { ErrorCode } from "@aido/api/errors";
import request from "supertest";
/**
 * 오늘의 할 일 요약 E2E 테스트 (홈 위젯용 GET /todos/summary)
 *
 * @description
 * 진행률 + 스트릭 + 상위 할 일을 한 번에 반환하는 위젯 스냅샷 엔드포인트.
 * X-Timezone 헤더 기준 "오늘" 판정과 정적 세그먼트 라우팅(:id 미충돌)을 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import { todo as todoTable } from "#api/platform/database/schema/index";
import { nowInstant, todayIn } from "#test/fixtures/clock.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("오늘의 할 일 요약 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const password = "Test1234!";
  const timezone = "Asia/Seoul";
  const activeDateRange = () => {
    const today = todayIn(timezone);
    return {
      today,
      startDate: today.subtract({ days: 1 }),
      endDate: today.add({ days: 1 }),
    };
  };

  describe("GET /todos/summary", () => {
    it("오늘 진행률·스트릭·상위 할 일을 요약으로 반환한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("todo-summary@test.com", password);
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

      const { startDate, endDate } = activeDateRange();
      const client = ctx.testDatabase.getClient();
      await client.insert(todoTable).values([
        {
          userId: user.userId,
          title: "완료한 할 일",
          categoryId,
          startDate,
          endDate,
          sortOrder: 0,
          completed: true,
          completedAt: nowInstant(),
          updatedAt: nowInstant(),
        },
        {
          userId: user.userId,
          title: "남은 할 일 1",
          categoryId,
          startDate,
          endDate,
          sortOrder: 1,
          completed: false,
          updatedAt: nowInstant(),
        },
        {
          userId: user.userId,
          title: "남은 할 일 2",
          categoryId,
          startDate,
          endDate,
          sortOrder: 2,
          completed: false,
          updatedAt: nowInstant(),
        },
      ]);

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        date: todayIn(timezone).toString(),
        totalTodos: 3,
        completedTodos: 1,
        completionRate: 33,
        isComplete: false,
        currentStreak: expect.any(Number),
        topTodos: [
          {
            id: expect.any(Number),
            title: "남은 할 일 1",
            completed: false,
            categoryColor: expect.any(String),
          },
          {
            id: expect.any(Number),
            title: "남은 할 일 2",
            completed: false,
            categoryColor: expect.any(String),
          },
          {
            id: expect.any(Number),
            title: "완료한 할 일",
            completed: true,
            categoryColor: expect.any(String),
          },
        ],
      });
    });

    it("할 일이 없는 날은 빈 요약(완료율 0)을 반환한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("todo-summary-empty@test.com", password);

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.totalTodos).toBe(0);
      expect(response.body.data.completionRate).toBe(0);
      expect(response.body.data.isComplete).toBe(false);
      expect(response.body.data.topTodos).toEqual([]);
    });

    it("상위 할 일은 최대 10개, 미완료가 항상 완료보다 먼저 온다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("todo-summary-limit@test.com", password);
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
      const { startDate, endDate } = activeDateRange();
      const client = ctx.testDatabase.getClient();
      await client.insert(todoTable).values(
        Array.from({ length: 12 }, (_, i) => ({
          userId: user.userId,
          title: `할 일 ${i + 1}`,
          categoryId,
          startDate,
          endDate,
          sortOrder: i,
          completed: i < 6,
          updatedAt: nowInstant(),
          ...(i < 6 && { completedAt: nowInstant() }),
        })),
      );

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.totalTodos).toBe(12);
      expect(response.body.data.topTodos).toHaveLength(10);

      const completedFlags = response.body.data.topTodos.map(
        (todo: { completed: boolean }) => todo.completed,
      );
      expect(completedFlags).toEqual([
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        true,
        true,
        true,
      ]);
    });

    it("date로 내일을 요청하면 내일 할 일 기준 요약을 반환한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("todo-summary-tomorrow@test.com", password);
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
      const today = todayIn(timezone);
      const tomorrow = today.add({ days: 1 });
      const client = ctx.testDatabase.getClient();
      await client.insert(todoTable).values(
        [
          {
            title: "오늘 할 일",
            startDate: today,
            endDate: today,
            sortOrder: 0,
            updatedAt: nowInstant(),
          },
          {
            title: "내일 할 일 1",
            startDate: tomorrow,
            endDate: tomorrow,
            sortOrder: 1,
            updatedAt: nowInstant(),
          },
          {
            title: "내일 할 일 2",
            startDate: tomorrow,
            endDate: tomorrow,
            sortOrder: 2,
            updatedAt: nowInstant(),
          },
        ].map((todo) => ({
          ...todo,
          userId: user.userId,
          categoryId,
          completed: false,
          updatedAt: nowInstant(),
        })),
      );

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .query({ date: tomorrow.toString() })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        date: tomorrow.toString(),
        totalTodos: 2,
        completedTodos: 0,
      });
      expect(response.body.data.topTodos.map((todo: { title: string }) => todo.title)).toEqual([
        "내일 할 일 1",
        "내일 할 일 2",
      ]);
    });

    it.each([
      { name: "어제", offsetDays: -1 },
      { name: "모레", offsetDays: 2 },
    ])("date로 $name를 요청하면 400 SYS_0002를 반환한다", async ({ offsetDays }) => {
      // Given
      const user = await ctx.helpers.createVerifiedUser(
        `todo-summary-range-${offsetDays}@test.com`,
        password,
      );
      const outOfRange = todayIn(timezone).add({ days: offsetDays }).toString();

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .query({ date: outOfRange })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
    });

    it("윤년이 아닌 해의 2월 29일처럼 없는 날짜는 400을 반환한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("todo-summary-invalid@test.com", password);

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .query({ date: "2027-02-29" })
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(400);
    });

    it("인증 없이 호출하면 401을 반환한다", async () => {
      // When
      const response = await request(ctx.app.getHttpServer()).get("/v1/todos/summary");

      // Then
      expect(response.status).toBe(401);
    });

    it("summary 정적 세그먼트가 :id 라우트로 매칭되지 않는다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("todo-summary-route@test.com", password);

      // When - :id 라우트였다면 "summary"가 숫자 파싱에 실패해 400이 됐을 것
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todos/summary")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", timezone);

      // Then
      expect(response.status).toBe(200);
    });
  });
});

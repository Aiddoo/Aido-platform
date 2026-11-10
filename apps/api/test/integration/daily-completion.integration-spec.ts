import dayjs from "dayjs";

import { DailyCompletionRepositoryPort } from "#api/modules/insights/daily-completions/application/ports/daily-completion.repository.port";
import { GetDailyCompletionsUseCase } from "#api/modules/insights/daily-completions/application/use-cases/get-daily-completions.use-case";
import { DateRange } from "#api/modules/insights/daily-completions/domain/date-range.vo";
import { toDailyCompletionsRangeResponse } from "#api/modules/insights/daily-completions/presentation/http/v1/daily-completion-response.mapper";
import { todo, todoCategory } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { UserFixture } from "#test/fixtures/index";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { TestDatabase, type TestDatabaseClient } from "../setup/test-database.js";

describe("DailyCompletion 통합 테스트 (실제 DB)", () => {
  let context: E2eTestContext;
  let getDailyCompletionsUseCase: GetDailyCompletionsUseCase;
  let repository: DailyCompletionRepositoryPort;
  let testDb: TestDatabase;
  let client: TestDatabaseClient;
  beforeAll(async () => {
    testDb = new TestDatabase();
    client = await testDb.start();
    context = await createE2eApp({ testDatabase: testDb });
    getDailyCompletionsUseCase = context.module.get(GetDailyCompletionsUseCase);
    repository = context.module.get(DailyCompletionRepositoryPort);
  });

  async function getDailyCompletions(userId: string, startDate: string, endDate: string) {
    return toDailyCompletionsRangeResponse(
      await getDailyCompletionsUseCase.execute({
        userId,
        startDate: Temporal.PlainDate.from(startDate),
        endDate: Temporal.PlainDate.from(endDate),
      }),
    );
  }

  // 반열림 [startDate, endDate) Date 구간을 저장소의 양끝 포함 달력 구간으로 바꾼다
  function rangeQuery(params: { userId: string; startDate: Date; endDate: Date }) {
    const toDay = (date: Date) => Temporal.PlainDate.from(date.toISOString().slice(0, 10));
    return {
      userId: UserId.reconstitute(params.userId),
      range: DateRange.create(toDay(params.startDate), toDay(params.endDate).subtract({ days: 1 })),
    };
  }

  async function aggregateByDateRange(params: { userId: string; startDate: Date; endDate: Date }) {
    const completions = await repository.listByDateRange(rangeQuery(params));
    return completions.map((completion) => ({
      date: completion.date.toString(),
      total: completion.totalTodos,
      completed: completion.completedTodos,
    }));
  }

  beforeEach(async () => {
    await context.reset();
  });
  afterAll(async () => {
    if (context !== undefined) {
      await destroyE2eApp(context);
    } else if (testDb !== undefined) {
      await testDb.stop();
    }
  });

  /**
   * 테스트용 사용자 생성 (기본 카테고리 포함)
   */
  async function createTestUser(
    email = "test@example.com",
  ): Promise<{ id: string; defaultCategoryId: number }> {
    const user = await createUserDatabaseFixture(
      client,
      UserFixture.create({ email, status: "ACTIVE" }),
      { profile: { name: "Test User" } },
    );

    // 기본 카테고리 생성
    const [category] = await client
      .insert(todoCategory)
      .values({ userId: user.id, name: "할 일", color: "#FF6B43", sortOrder: 0 })
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }

    return { id: user.id, defaultCategoryId: category.id };
  }

  /**
   * 테스트용 Todo 생성
   * @param userId - 사용자 ID
   * @param categoryId - 카테고리 ID
   * @param startDate - 시작 날짜 (문자열 "YYYY-MM-DD" 또는 Date)
   * @param completed - 완료 여부
   */
  async function createTestTodo(
    userId: string,
    categoryId: number,
    startDate: string | Date,
    completed = false,
  ): Promise<{ id: number }> {
    // 문자열인 경우 UTC 자정으로 변환
    const dateValue =
      typeof startDate === "string" ? dayjs.utc(startDate).startOf("day").toDate() : startDate;

    const [created] = await client
      .insert(todo)
      .values({
        userId,
        categoryId,
        title: "일일 완료 집계 fixture",
        startDate: dateValue,
        completed,
      })
      .returning({ id: todo.id });
    if (created === undefined) {
      throw new Error("todo fixture was not created");
    }
    return created;
  }

  /**
   * 특정 날짜에 여러 Todo 생성
   * @param userId - 사용자 ID
   * @param categoryId - 카테고리 ID
   * @param date - 날짜 문자열 "YYYY-MM-DD"
   * @param total - 총 Todo 수
   * @param completed - 완료된 Todo 수
   */
  async function createTodosForDate(
    userId: string,
    categoryId: number,
    date: string,
    total: number,
    completed: number,
  ): Promise<void> {
    const promises = [];
    for (let i = 0; i < total; i++) {
      promises.push(createTestTodo(userId, categoryId, date, i < completed));
    }
    await Promise.all(promises);
  }

  describe("DailyCompletionRepository.findMultiDayTodos", () => {
    async function createMultiDayTodo(
      userId: string,
      categoryId: number,
      startDate: string,
      endDate: string,
      visibility: "PUBLIC" | "PRIVATE" = "PUBLIC",
    ): Promise<void> {
      await client.insert(todo).values({
        userId,
        categoryId,
        title: "여러 날 할 일 fixture",
        startDate: dayjs.utc(startDate).toDate(),
        endDate: dayjs.utc(endDate).toDate(),
        visibility,
      });
    }

    const JANUARY = { startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01") };

    it("기간과 겹치는 여러 날 할 일만 찾고 하루짜리와 기간 밖은 뺀다", async () => {
      // Given
      const user = await createTestUser();
      const categoryId = user.defaultCategoryId;
      await createMultiDayTodo(user.id, categoryId, "2025-12-30", "2026-01-02");
      await createMultiDayTodo(user.id, categoryId, "2026-01-30", "2026-02-03");
      await createMultiDayTodo(user.id, categoryId, "2025-12-01", "2025-12-31");
      await createMultiDayTodo(user.id, categoryId, "2026-02-01", "2026-02-03");
      await createMultiDayTodo(user.id, categoryId, "2026-01-10", "2026-01-10");
      await createTestTodo(user.id, categoryId, "2026-01-15");
      // When
      const result = await repository.listMultiDayTodoSpans(
        rangeQuery({ userId: user.id, ...JANUARY }),
      );
      // Then
      expect(
        result.map(({ startDate, endDate }) => [startDate.toString(), endDate.toString()]).sort(),
      ).toEqual([
        ["2025-12-30", "2026-01-02"],
        ["2026-01-30", "2026-02-03"],
      ]);
      expect(result[0]?.categoryColor).toEqual(expect.any(String));
    });

    it("친구에게는 공개 할 일만 준다", async () => {
      // Given
      const user = await createTestUser();
      const categoryId = user.defaultCategoryId;
      await createMultiDayTodo(user.id, categoryId, "2026-01-05", "2026-01-07");
      await createMultiDayTodo(user.id, categoryId, "2026-01-10", "2026-01-12", "PRIVATE");
      // When
      const result = await repository.listPublicMultiDayTodoSpans(
        rangeQuery({ userId: user.id, ...JANUARY }),
      );
      // Then
      expect(result.map(({ startDate }) => startDate.toString())).toEqual(["2026-01-05"]);
    });
  });

  describe("DailyCompletionRepository.aggregateByDateRange", () => {
    it("날짜 범위 내 Todo를 날짜별로 집계해야 한다", async () => {
      // Given
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 3, 2);
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-16", 2, 2);

      // When
      const result = await aggregateByDateRange({
        userId: user.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
      });

      // Then
      expect(result).toHaveLength(2);

      const day15 = result.find((r) => r.date === "2026-01-15");
      const day16 = result.find((r) => r.date === "2026-01-16");

      expect(day15?.total).toBe(3);
      expect(day15?.completed).toBe(2);
      expect(day16?.total).toBe(2);
      expect(day16?.completed).toBe(2);
    });

    it("카테고리 색은 중복 없이 문자열 오름차순으로 내려준다(앱 정렬과 같은 순서)", async () => {
      // Given
      const user = await createTestUser();
      const colors = ["#FFB3B3", "#00AA00", "#FF6B43"];
      for (const [sortOrder, color] of colors.entries()) {
        const [category] = await client
          .insert(todoCategory)
          .values({ userId: user.id, name: `색 ${color}`, color, sortOrder: sortOrder + 1 })
          .returning();
        await createTestTodo(user.id, category?.id ?? 0, "2026-01-15");
      }
      await createTestTodo(user.id, user.defaultCategoryId, "2026-01-15", true);

      // When
      const result = await repository.aggregateByDateRange({
        userId: user.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
      });

      // Then
      expect(result.map((day) => day.categoryColors)).toEqual([["#00AA00", "#FF6B43", "#FFB3B3"]]);
    });

    it("다른 사용자의 Todo는 포함하지 않아야 한다", async () => {
      // Given - 두 사용자가 같은 날짜에 Todo를 가짐
      const user1 = await createTestUser("user1@example.com");
      const user2 = await createTestUser("user2@example.com");
      await createTodosForDate(user1.id, user1.defaultCategoryId, "2026-01-15", 3, 3);
      await createTodosForDate(user2.id, user2.defaultCategoryId, "2026-01-15", 5, 1);

      // When - user1의 Todo만 집계
      const result = await aggregateByDateRange({
        userId: user1.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
      });

      // Then - user1의 Todo만 반환
      expect(result).toHaveLength(1);
      expect(result[0]?.total).toBe(3);
      expect(result[0]?.completed).toBe(3);
    });

    it("날짜 범위 외의 Todo는 포함하지 않아야 한다", async () => {
      // Given - 범위 내외에 각각 Todo가 있음
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2025-12-31", 2, 1);
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 3, 2);
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-02-01", 1, 1);

      // When - 1월 범위만 조회
      const result = await aggregateByDateRange({
        userId: user.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
      });

      // Then - 범위 내 Todo만 반환
      expect(result).toHaveLength(1);
      expect(result[0]?.total).toBe(3);
    });

    it("Todo가 없으면 빈 배열을 반환해야 한다", async () => {
      // Given - Todo가 없는 사용자
      const user = await createTestUser();

      // When - 날짜 범위로 집계 조회
      const result = await aggregateByDateRange({
        userId: user.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
      });

      // Then - 빈 배열 반환
      expect(result).toEqual([]);
    });
  });

  describe("일일 완료 조회", () => {
    it("날짜 범위 내 완료 현황을 반환해야 한다", async () => {
      // Given
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 3, 3); // 완료
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-16", 2, 1); // 미완료

      // When
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then
      expect(result.completions).toHaveLength(2);
      expect(result.totalCompleteDays).toBe(1);
      expect(result.dateRange).toEqual({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });
    });

    it("완료율을 정확히 계산해야 한다", async () => {
      // Given
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 4, 3); // 75%

      // When
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then
      const day15 = result.completions.find((c) => c.date === "2026-01-15");
      expect(day15?.completionRate).toBe(75);
      expect(day15?.isComplete).toBe(false);
    });

    it("모든 Todo 완료 시 isComplete가 true여야 한다", async () => {
      // Given
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 5, 5);

      // When
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then
      const day15 = result.completions.find((c) => c.date === "2026-01-15");
      expect(day15?.isComplete).toBe(true);
      expect(day15?.completionRate).toBe(100);
    });

    it("결과를 날짜순으로 정렬해야 한다", async () => {
      // Given
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-20", 1, 1);
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-10", 2, 1);
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 3, 2);

      // When
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then
      expect(result.completions[0]?.date).toBe("2026-01-10");
      expect(result.completions[1]?.date).toBe("2026-01-15");
      expect(result.completions[2]?.date).toBe("2026-01-20");
    });

    it("Todo가 없으면 빈 결과를 반환해야 한다", async () => {
      // Given - Todo가 없는 사용자
      const user = await createTestUser();

      // When - 완료 현황 조회
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then - 빈 결과 반환
      expect(result.completions).toEqual([]);
      expect(result.totalCompleteDays).toBe(0);
    });
  });

  describe("경계 조건", () => {
    it("월 경계를 정확히 처리해야 한다", async () => {
      // Given - 1월 마지막 날과 2월 첫 날에 Todo가 있음
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-31", 2, 2);
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-02-01", 3, 1);

      // When - 1월만 조회
      const janResult = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then - 1월 데이터만 반환
      expect(janResult.completions).toHaveLength(1);
      expect(janResult.completions[0]?.date).toBe("2026-01-31");

      // When - 2월만 조회
      const febResult = await getDailyCompletions(user.id, "2026-02-01", "2026-02-28");

      // Then - 2월 데이터만 반환
      expect(febResult.completions).toHaveLength(1);
      expect(febResult.completions[0]?.date).toBe("2026-02-01");
    });

    it("하루 동안의 여러 Todo를 정확히 집계해야 한다", async () => {
      // Given - 같은 날짜에 10개 Todo (7개 완료)
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 10, 7);

      // When - 해당 날짜 조회
      const result = await getDailyCompletions(user.id, "2026-01-15", "2026-01-15");

      // Then - 정확한 집계 결과 반환
      expect(result.completions).toHaveLength(1);
      expect(result.completions[0]?.totalTodos).toBe(10);
      expect(result.completions[0]?.completedTodos).toBe(7);
      expect(result.completions[0]?.completionRate).toBe(70);
    });

    it("완료된 Todo가 0개인 날도 정확히 처리해야 한다", async () => {
      // Given - 완료된 Todo가 없는 날
      const user = await createTestUser();
      await createTodosForDate(user.id, user.defaultCategoryId, "2026-01-15", 5, 0);

      // When - 완료 현황 조회
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then - 0% 완료율 반환
      const day15 = result.completions.find((c) => c.date === "2026-01-15");
      expect(day15?.totalTodos).toBe(5);
      expect(day15?.completedTodos).toBe(0);
      expect(day15?.completionRate).toBe(0);
      expect(day15?.isComplete).toBe(false);
    });
  });

  describe("대량 데이터 처리", () => {
    it("한 달의 완료 현황을 빠짐없이 날짜별로 반환해야 한다", async () => {
      // Given - 한 달 동안 매일 3개씩 Todo 생성
      const user = await createTestUser();
      const promises = [];
      for (let day = 1; day <= 31; day++) {
        const dateStr = `2026-01-${String(day).padStart(2, "0")}`;
        promises.push(createTodosForDate(user.id, user.defaultCategoryId, dateStr, 3, day % 4));
      }
      await Promise.all(promises);

      // When - 한 달 전체 조회
      const result = await getDailyCompletions(user.id, "2026-01-01", "2026-01-31");

      // Then - 모든 날짜와 완료 수가 정확히 반환됨
      expect(result.completions).toHaveLength(31);
      expect(result.completions.at(0)?.date).toBe("2026-01-01");
      expect(result.completions.at(-1)?.date).toBe("2026-01-31");
      expect(result.completions.reduce((total, day) => total + day.totalTodos, 0)).toBe(93);
      expect(result.completions.reduce((total, day) => total + day.completedTodos, 0)).toBe(48);
      expect(result.totalCompleteDays).toBe(8);
    });
  });
});

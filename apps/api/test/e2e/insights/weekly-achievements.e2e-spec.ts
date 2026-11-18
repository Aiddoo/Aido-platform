import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementYearsResponseSchema,
} from "@aido/api/contracts/weekly-achievement/v1";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { weeklyAchievement } from "#api/platform/database/schema/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { DAILY_COMPLETION_FIXTURE_NOW } from "#test/fixtures/insights/daily-completion.fixture";

describe("주간 달성 실제 HTTP·PostgreSQL 계약", () => {
  let context: E2eTestContext;
  beforeAll(async () => {
    context = await createE2eApp();
  }, 60_000);
  afterAll(async () => {
    await destroyE2eApp(context);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(DAILY_COMPLETION_FIXTURE_NOW.epochMilliseconds);
  });
  afterEach(() => vi.useRealTimers());

  async function seedWeeks(userId: string, weeks: readonly number[]) {
    return context.testDatabase
      .getClient()
      .insert(weeklyAchievement)
      .values(
        weeks.map((week) => ({
          userId,
          year: 2026,
          week,
          totalTodos: 5,
          completedTodos: 5,
          achievedAt: Temporal.Instant.from("2026-03-09T00:00:00Z"),
        })),
      );
  }

  it("연도 전체 요약은 페이지 크기와 무관하고 커서로 이전 주차를 중복 없이 이어서 조회한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "weekly-pagination@example.com",
      "Test1234!",
    );
    await seedWeeks(user.userId, [1, 2, 3]);

    // When
    const first = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements")
      .query({ year: 2026, size: 2 })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const firstData = weeklyAchievementListResponseSchema.parse(first.body.data);
    const second = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements")
      .query({ year: 2026, size: 2, cursor: firstData.pagination.nextCursor })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const secondData = weeklyAchievementListResponseSchema.parse(second.body.data);

    // Then
    expect(firstData.items.map((item) => item.week)).toEqual([3, 2]);
    expect(firstData.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(secondData.items.map((item) => item.week)).toEqual([1]);
    expect(secondData.pagination).toEqual({ nextCursor: null, hasNext: false, size: 2 });
    expect(firstData.summary).toEqual({
      totalWeeks: 3,
      perfectWeeks: 3,
      currentStreak: 3,
      bestStreak: 3,
      averageRate: 100,
    });
    expect(secondData.summary).toEqual(firstData.summary);
  });

  it("ISO 연도가 바뀌어도 기록 있는 연도로 지난해를 찾고 새해 연속 주는 지난해 53주에서 잇는다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "weekly-year-boundary@example.com",
      "Test1234!",
    );
    const other = await context.helpers.createVerifiedUser(
      "weekly-year-boundary-other@example.com",
      "Test1234!",
    );
    await context.testDatabase
      .getClient()
      .insert(weeklyAchievement)
      .values(
        [
          { userId: user.userId, year: 2026, week: 52 },
          { userId: user.userId, year: 2026, week: 53 },
          { userId: user.userId, year: 2027, week: 1 },
          { userId: other.userId, year: 2028, week: 1 },
        ].map((row) => ({
          ...row,
          totalTodos: 4,
          completedTodos: 4,
          achievedAt: Temporal.Instant.from("2027-01-11T00:00:00Z"),
        })),
      );
    const get = (path: string, query: Record<string, number> = {}) =>
      request(context.app.getHttpServer())
        .get(path)
        .query(query)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

    // When
    const years = weeklyAchievementYearsResponseSchema.parse(
      (await get("/v1/weekly-achievements/years")).body.data,
    );
    const newYear = weeklyAchievementListResponseSchema.parse(
      (await get("/v1/weekly-achievements", { year: 2027 })).body.data,
    );
    const lastYear = weeklyAchievementListResponseSchema.parse(
      (await get("/v1/weekly-achievements", { year: 2026 })).body.data,
    );

    // Then
    expect(years).toEqual({ years: [2027, 2026] });
    expect(newYear.items.map((item) => [item.year, item.week])).toEqual([[2027, 1]]);
    expect(newYear.summary).toMatchObject({ totalWeeks: 1, currentStreak: 3, bestStreak: 3 });
    expect(lastYear.items.map((item) => [item.year, item.week])).toEqual([
      [2026, 53],
      [2026, 52],
    ]);
    expect(lastYear.summary).toMatchObject({ totalWeeks: 2, currentStreak: 2, bestStreak: 2 });
  });

  it("기록이 없는 사용자의 연도 목록은 비어 있다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "weekly-no-years@example.com",
      "Test1234!",
    );

    // When
    const response = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements/years")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // Then
    expect(weeklyAchievementYearsResponseSchema.parse(response.body.data)).toEqual({ years: [] });
  });

  it("기록 없는 사용자의 목록에 다른 사용자의 달성 기록이 섞이지 않는다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("weekly-empty@example.com", "Test1234!");
    const other = await context.helpers.createVerifiedUser("weekly-other@example.com", "Test1234!");
    await seedWeeks(other.userId, [10]);

    // When
    const response = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements")
      .query({ year: 2026 })
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    const result = weeklyAchievementListResponseSchema.parse(response.body.data);

    // Then
    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({ nextCursor: null, hasNext: false, size: 20 });
    expect(result.summary).toEqual({
      totalWeeks: 0,
      perfectWeeks: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageRate: 0,
    });
  });

  it.each([
    { language: "ko", now: "2026-11-12T03:00:00Z", label: "3월 1주차" },
    { language: "en", now: "2026-11-12T03:00:00Z", label: "Week 1 of Mar" },
    // 다른 해에 보면 주차 달의 연도를 붙인다(라벨의 올해는 저장 시간대, 테스트 사용자는 UTC)
    { language: "ko", now: DAILY_COMPLETION_FIXTURE_NOW.toString(), label: "2026년 3월 1주차" },
    { language: "en", now: DAILY_COMPLETION_FIXTURE_NOW.toString(), label: "Week 1 of Mar 2026" },
  ])(
    "$language 헤더·$now에는 주차 라벨이 $label이고 저장된 완료율·날짜는 유지한다",
    async ({ language, now, label }) => {
      // Given
      vi.setSystemTime(Temporal.Instant.from(now).epochMilliseconds);
      const user = await context.helpers.createVerifiedUser(
        `weekly-detail-${language}@example.com`,
        "Test1234!",
      );
      await context.testDatabase
        .getClient()
        .insert(weeklyAchievement)
        .values({
          userId: user.userId,
          year: 2026,
          week: 10,
          totalTodos: 10,
          completedTodos: 7,
          achievedAt: Temporal.Instant.from("2026-03-09T00:00:00Z"),
        });

      // When
      const response = await request(context.app.getHttpServer())
        .get("/v1/weekly-achievements/2026/10")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("Accept-Language", language)
        .expect(200);
      const result = weeklyAchievementDetailResponseSchema.parse(response.body.data);

      // Then
      expect(result).toMatchObject({
        year: 2026,
        week: 10,
        weekLabel: label,
        dateRange: { startDate: "2026-03-02", endDate: "2026-03-08" },
        totalTodos: 10,
        completedTodos: 7,
        completionRate: 70,
        achievedAt: "2026-03-09T00:00:00.000Z",
      });
    },
  );

  it("year가 없는 목록 요청은 400으로 거절한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("weekly-noyear@example.com", "Test1234!");

    // When
    const response = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);

    // Then
    expect(response.body.success).toBe(false);
  });

  it("다른 사용자에게만 존재하는 주차의 상세는 404 ACHIEVEMENT_1801을 반환한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "weekly-missing@example.com",
      "Test1234!",
    );
    const other = await context.helpers.createVerifiedUser(
      "weekly-private@example.com",
      "Test1234!",
    );
    await seedWeeks(other.userId, [10]);

    // When
    const response = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements/2026/10")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(404);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.ACHIEVEMENT_1801);
  });

  it("52주인 해의 53주 상세는 출시 응답처럼 404 ACHIEVEMENT_1801이다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "weekly-week-53@example.com",
      "Test1234!",
    );

    // When
    const response = await request(context.app.getHttpServer())
      .get("/v1/weekly-achievements/2027/53")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(404);

    // Then
    expect(response.body.error.code).toBe(ErrorCode.ACHIEVEMENT_1801);
  });

  it.each([
    "/v1/weekly-achievements?year=2026",
    "/v1/weekly-achievements/years",
    "/v1/weekly-achievements/2026/10",
  ])("인증 없는 %s 요청은 401로 거절한다", async (path) => {
    // Given

    // When
    const response = await request(context.app.getHttpServer()).get(path).expect(401);

    // Then
    expect(response.body.success).toBe(false);
  });
});

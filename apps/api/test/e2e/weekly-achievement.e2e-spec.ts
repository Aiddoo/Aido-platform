import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { encodeCreate } from "#api/platform/database/database-records";
import { INSIGHTS_TIME } from "#test/fixtures/insights.fixture";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("주간 달성 실제 HTTP·PostgreSQL 계약", () => {
  let context: E2eTestContext;
  beforeAll(async () => {
    context = await createE2eApp();
  }, 60000);
  afterAll(async () => {
    await destroyE2eApp(context);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  async function seedWeeks(userId: string, weeks: readonly number[]) {
    return context.testDatabase.getClient().orm.public.WeeklyAchievement.createAll(
      weeks.map((week) =>
        encodeCreate("WeeklyAchievement", {
          userId,
          year: 2026,
          week,
          totalTodos: 5,
          completedTodos: 5,
          achievedAt: new Date("2026-03-09T00:00:00.000Z"),
        }),
      ),
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
    { language: "ko", label: "3월 1주차" },
    { language: "en", label: "Week 1 of Mar" },
  ])(
    "$language 헤더는 주차 라벨을 바꾸고 저장된 완료율·날짜는 유지한다",
    async ({ language, label }) => {
      // Given
      const user = await context.helpers.createVerifiedUser(
        `weekly-detail-${language}@example.com`,
        "Test1234!",
      );
      await context.testDatabase.getClient().orm.public.WeeklyAchievement.create(
        encodeCreate("WeeklyAchievement", {
          userId: user.userId,
          year: 2026,
          week: 10,
          totalTodos: 10,
          completedTodos: 7,
          achievedAt: new Date("2026-03-09T00:00:00.000Z"),
        }),
      );
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

  it.each(["/v1/weekly-achievements?year=2026", "/v1/weekly-achievements/2026/10"])(
    "인증 없는 %s 요청은 401로 거절한다",
    async (path) => {
      // Given - 인증 헤더가 없는 요청
      // When
      const response = await request(context.app.getHttpServer()).get(path).expect(401);
      // Then
      expect(response.body.success).toBe(false);
    },
  );
});

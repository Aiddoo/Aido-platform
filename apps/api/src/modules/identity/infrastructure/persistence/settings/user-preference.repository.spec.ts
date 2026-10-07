import { and } from "@prisma/orm-postgres/orm-client";

import { databaseDate, varchar } from "#api/platform/database/database-values";
import { UserPreferenceBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { UserPreferenceRepository } from "./user-preference.repository.js";

const userId = "user-123";
const yesterday = new Date("2026-12-31T00:00:00.000Z");
const today = new Date("2027-01-01T00:00:00.000Z");

describe("UserPreferenceRepository — 부분 설정 저장과 스트릭 조건부 갱신", () => {
  let repository: UserPreferenceRepository;
  let db: MockDatabaseContext;

  beforeEach(() => {
    db = createMockDatabaseContext();
    repository = new UserPreferenceRepository(createMockTransactionHost(db));
  });

  it.each(["create", "upsert"])(
    "%s는 첫 저장에서도 weather 값과 false·0을 전달한다",
    async (method) => {
      // Given
      const fixture = UserPreferenceBuilder.create(userId).build();
      db.orm.public.UserPreference.create.mockResolvedValue(
        databaseFixture("UserPreference", fixture),
      );
      db.orm.public.UserPreference.upsert.mockResolvedValue(
        databaseFixture("UserPreference", fixture),
      );
      const input = {
        pushEnabled: false,
        nightPushEnabled: false,
        weatherMorningEnabled: false,
        weatherMorningHour: 0,
        weatherMorningMinute: 0,
        weatherEveningEnabled: false,
        weatherEveningHour: 22,
        weatherEveningMinute: 43,
      };

      // When
      if (method === "create") await repository.create(userId, input);
      else await repository.upsert(userId, input);

      // Then
      const encoded = databaseWriteExpectation("UserPreference", { userId, ...input });
      if (method === "create") {
        expect(db.orm.public.UserPreference.create).toHaveBeenCalledWith(
          expect.objectContaining(encoded),
        );
      } else {
        expect(db.orm.public.UserPreference.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining(encoded),
            update: databaseWriteExpectation("UserPreference", input),
          }),
        );
      }
    },
  );

  it("일반 설정 생성의 push 기본값은 true를 유지한다", async () => {
    // Given
    db.orm.public.UserPreference.create.mockResolvedValue(
      databaseFixture("UserPreference", UserPreferenceBuilder.create(userId).build()),
    );

    // When
    await repository.create(userId);

    // Then
    expect(db.orm.public.UserPreference.create).toHaveBeenCalledWith(
      expect.objectContaining(
        databaseWriteExpectation("UserPreference", {
          userId,
          pushEnabled: true,
          nightPushEnabled: true,
        }),
      ),
    );
  });

  it("부분 변경에서 undefined 필드는 생략하고 지정한 필드만 갱신한다", async () => {
    // Given
    db.orm.public.UserPreference.upsert.mockResolvedValue(
      databaseFixture("UserPreference", UserPreferenceBuilder.create(userId).build()),
    );

    // When
    await repository.upsert(userId, { timezone: undefined, weatherMorningEnabled: false });

    // Then
    expect(db.orm.public.UserPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: databaseWriteExpectation("UserPreference", { weatherMorningEnabled: false }),
      }),
    );
  });

  it.each([null, yesterday])(
    "스트릭의 이전 카운터와 nullable 완료일을 실제 조건부 UPDATE에 전달한다: %s",
    async (lastCompletedDate) => {
      // Given
      db.orm.public.UserPreference.updateAndCount.mockResolvedValue(1);
      const expected = { currentStreak: 2, longestStreak: 4, lastCompletedDate };
      const next = { currentStreak: 3, longestStreak: 4, lastCompletedDate: today };

      // When
      const saved = await repository.updateStreakIfUnchanged(userId, expected, next);

      // Then
      expect(saved).toBe(true);
      assertNativeWhere(
        "UserPreference",
        db.orm.public.UserPreference.where.mock.calls[0]?.[0],
        (row) =>
          and(
            row.userId.eq(userId),
            row.currentStreak.eq(2),
            row.longestStreak.eq(4),
            lastCompletedDate === null
              ? row.lastCompletedDate.isNull()
              : row.lastCompletedDate.eq(databaseDate(lastCompletedDate)),
          ),
      );
      expect(db.orm.public.UserPreference.updateAndCount).toHaveBeenCalledWith(
        databaseWriteExpectation("UserPreference", next),
      );
    },
  );

  it("스트릭 상태가 이미 바뀌었으면 충돌을 반환한다", async () => {
    // Given
    db.orm.public.UserPreference.updateAndCount.mockResolvedValue(0);

    // When
    const saved = await repository.updateStreakIfUnchanged(
      userId,
      { currentStreak: 2, longestStreak: 2, lastCompletedDate: yesterday },
      { currentStreak: 3, longestStreak: 3, lastCompletedDate: today },
    );

    // Then
    expect(saved).toBe(false);
  });

  it("timezone 자가치유는 다른 값인 기존 행만 조건부 갱신한다", async () => {
    // Given
    db.orm.public.UserPreference.updateAndCount.mockResolvedValue(0);

    // When
    expect(await repository.refreshTimezoneIfChanged(userId, "Asia/Seoul")).toBe(0);

    // Then
    assertNativeWhere(
      "UserPreference",
      db.orm.public.UserPreference.where.mock.calls[0]?.[0],
      (row) => and(row.userId.eq(userId), row.timezone.neq(varchar("Asia/Seoul", 50))),
    );
    expect(db.orm.public.UserPreference.upsert).not.toHaveBeenCalled();
  });

  it("빈 사용자 목록은 DB에 조회하지 않는다", async () => {
    // Given
    const userIds: readonly string[] = [];

    // When
    expect(await repository.findByUserIds(userIds)).toEqual([]);

    // Then
    expect(db.orm.public.UserPreference.where).not.toHaveBeenCalled();
  });
});

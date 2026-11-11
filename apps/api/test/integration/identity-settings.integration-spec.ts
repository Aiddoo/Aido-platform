import { TransactionHost } from "@nestjs-cls/transactional";
import { eq, sql } from "drizzle-orm";
import { vi } from "vitest";

import { StreakMilestoneNotifierPort } from "#api/modules/identity/preferences/application/ports/streak-milestone-notifier.port";
import { UserSettingsCachePort } from "#api/modules/identity/preferences/application/ports/user-settings-cache.port";
import { GetPreferenceUseCase } from "#api/modules/identity/preferences/application/use-cases/get-preference.use-case";
import { OnTodoToggledUseCase } from "#api/modules/identity/preferences/application/use-cases/on-todo-toggled.use-case";
import { RefreshPushTimezoneUseCase } from "#api/modules/identity/preferences/application/use-cases/refresh-push-timezone.use-case";
import { SeedUserSettingsUseCase } from "#api/modules/identity/preferences/application/use-cases/seed-user-settings.use-case";
import { UpdatePreferenceUseCase } from "#api/modules/identity/preferences/application/use-cases/update-preference.use-case";
import { UpsertPushTimezoneUseCase } from "#api/modules/identity/preferences/application/use-cases/upsert-push-timezone.use-case";
import { DrizzleUserConsentRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
import type { Database, DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  user as userTable,
  userConsent,
  userPreference,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const at = new Date("2027-01-01T12:00:00.000Z");
const now = Temporal.Instant.from("2027-01-01T12:00:00.000Z");
const todayDate = Temporal.PlainDate.from("2027-01-01");
const yesterdayDate = Temporal.PlainDate.from("2026-12-31");
const yesterdayStart = Temporal.Instant.from("2026-12-31T00:00:00.000Z");
const weather = {
  weatherMorningEnabled: false,
  weatherMorningHour: 9,
  weatherMorningMinute: 37,
  weatherEveningEnabled: false,
  weatherEveningHour: 22,
  weatherEveningMinute: 43,
};

describe("사용자 설정 저장·캐시·동시 스트릭 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let context: E2eTestContext;
  let client: TestDatabaseClient;
  let preferences: DrizzleUserPreferenceRepository;
  let consents: DrizzleUserConsentRepository;
  let unitOfWork: UnitOfWorkPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      // 스트릭의 "오늘"을 vi.setSystemTime으로 고정한 날짜로 본다
      customizeBuilder: (builder) => builder.overrideProvider(ClockPort).useClass(DateClock),
    });
    preferences = context.module.get(DrizzleUserPreferenceRepository);
    consents = context.module.get(DrizzleUserConsentRepository);
    unitOfWork = context.module.get(UnitOfWorkPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "settings-owner@example.com",
      userTag: "SETPG001",
      createdAt: now,
      updatedAt: now,
    });
    await client.insert(userTable).values(user);
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function holdRowLock(lockRow: (transaction: DatabaseTransaction) => Promise<unknown>) {
    const released = Promise.withResolvers<void>();
    const acquired = Promise.withResolvers<void>();
    const holding = client.transaction(async (transaction) => {
      await lockRow(transaction);
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("경쟁 요청 전에 잠금이 해제되었습니다.");
      }),
    ]);
    return {
      async release() {
        released.resolve();
        await holding;
      },
    };
  }

  async function expectTwoUpdateWaiters(table: "UserPreference" | "UserConsent") {
    await vi.waitFor(
      async () => {
        const waiting = await client.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query ILIKE '%UPDATE%' AND query LIKE ${`%${table}%`}
        `);
        expect(waiting.rows[0]?.count).toBe(2);
      },
      { timeout: 10_000 },
    );
  }

  async function givenCompletedTodos() {
    const category = TodoCategoryFixture.create({ userId });
    await client.insert(todoCategory).values(category);
    for (let index = 0; index < 2; index += 1) {
      const created = TodoFixture.create({
        userId,
        categoryId: category.id,
        startDate: todayDate,
        completed: true,
        completedAt: instantFromDate(at),
      });
      await client.insert(todo).values(created);
    }
  }

  it.each([false, true])(
    "weather 부분 변경은 설정 행 존재 여부(%s)와 관계없이 요청값을 저장한다",
    async (exists) => {
      // Given
      if (exists) {
        await preferences.create(UserId.reconstitute(userId));
      }

      // When
      const response = await context.module
        .get(UpdatePreferenceUseCase)
        .execute({ userId, ...weather });
      const saved = await preferences.findByUserId(UserId.reconstitute(userId));

      // Then
      expect(response).toEqual(expect.objectContaining(weather));
      expect(saved).toEqual(expect.objectContaining(weather));
      expect(saved?.pushEnabled).toBe(true);
      expect(saved?.nightPushEnabled).toBe(true);
    },
  );

  it("캐시에 저장된 설정도 timezone 자가치유와 upsert 직후 최신 값을 반환한다", async () => {
    // Given
    await preferences.create(UserId.reconstitute(userId), { timezone: "UTC" });
    const get = context.module.get(GetPreferenceUseCase);
    expect((await get.execute({ userId })).timezone).toBe("UTC");

    // When
    await context.module
      .get(RefreshPushTimezoneUseCase)
      .execute({ userId, timezone: "Asia/Seoul" });

    // Then
    expect((await preferences.findByUserId(UserId.reconstitute(userId)))?.timezone).toBe(
      "Asia/Seoul",
    );
    expect((await get.execute({ userId })).timezone).toBe("Asia/Seoul");

    // When
    await context.module
      .get(UpsertPushTimezoneUseCase)
      .execute({ userId, timezone: "America/New_York" });

    // Then
    expect((await preferences.findByUserId(UserId.reconstitute(userId)))?.timezone).toBe(
      "America/New_York",
    );
    expect((await get.execute({ userId })).timezone).toBe("America/New_York");
  });

  it("없는 설정과 동일 timezone은 자가치유에서 생성·캐시 무효화를 하지 않는다", async () => {
    // Given
    const cache = context.module.get<UserSettingsCachePort>(UserSettingsCachePort);
    const invalidatePreference = vi.spyOn(cache, "invalidateUserPreference");
    const reminderTimezoneCache =
      context.module.get<ReminderTimezoneCachePort>(ReminderTimezoneCachePort);
    const invalidateTimezones = vi.spyOn(reminderTimezoneCache, "invalidateActiveTimezones");
    const refresh = context.module.get(RefreshPushTimezoneUseCase);

    // When
    await refresh.execute({ userId, timezone: "UTC" });

    // Then
    expect(await preferences.findByUserId(UserId.reconstitute(userId))).toBeNull();
    await preferences.create(UserId.reconstitute(userId), { timezone: "UTC" });

    // When
    await refresh.execute({ userId, timezone: "UTC" });

    // Then
    expect(invalidatePreference).not.toHaveBeenCalled();
    expect(invalidateTimezones).not.toHaveBeenCalled();
  });

  it("timezone 전용 최초 생성은 가입 seed와 같은 DB push 기본값(true)을 쓴다", async () => {
    // Given
    expect(await preferences.findByUserId(UserId.reconstitute(userId))).toBeNull();

    // When
    await preferences.upsertTimezone(UserId.reconstitute(userId), "Asia/Seoul");

    // Then
    expect(await preferences.findByUserId(UserId.reconstitute(userId))).toEqual(
      expect.objectContaining({
        timezone: "Asia/Seoul",
        pushEnabled: true,
        nightPushEnabled: true,
      }),
    );
  });

  it("같은 날 두 완료 요청의 UPDATE가 대기해도 스트릭과 마일스톤은 한 번 반영된다", async () => {
    // Given
    await preferences.create(UserId.reconstitute(userId));
    await client
      .update(userPreference)
      .set({ currentStreak: 2, longestStreak: 2, lastCompletedDate: yesterdayDate })
      .where(eq(userPreference.userId, userId));
    await givenCompletedTodos();
    const notifier = context.module.get<StreakMilestoneNotifierPort>(StreakMilestoneNotifierPort);
    const notification = vi.spyOn(notifier, "notifyStreak3Reached").mockImplementation(() => {});
    const lock = await holdRowLock((transaction) =>
      transaction
        .select({ id: userPreference.id })
        .from(userPreference)
        .where(eq(userPreference.userId, userId))
        .for("update"),
    );
    const useCase = context.module.get(OnTodoToggledUseCase);
    const requests = Promise.allSettled([
      useCase.execute({ userId, completed: true }),
      useCase.execute({ userId, completed: true }),
    ]);

    // When
    try {
      await expectTwoUpdateWaiters("UserPreference");
    } finally {
      await lock.release();
      await requests;
    }

    // Then
    expect((await requests).every((result) => result.status === "fulfilled")).toBe(true);
    expect(await preferences.findByUserId(UserId.reconstitute(userId))).toEqual(
      expect.objectContaining({ currentStreak: 3, longestStreak: 3, lastCompletedDate: todayDate }),
    );
    expect(notification).toHaveBeenCalledExactlyOnceWith(UserId.reconstitute(userId));
  });

  it("늦게 도착한 완료 취소 이벤트는 최신 Todo가 모두 완료된 상태를 되돌리지 않는다", async () => {
    // Given
    await preferences.create(UserId.reconstitute(userId));
    await client
      .update(userPreference)
      .set({ currentStreak: 3, longestStreak: 4, lastCompletedDate: todayDate })
      .where(eq(userPreference.userId, userId));
    await givenCompletedTodos();

    // When
    await context.module.get(OnTodoToggledUseCase).execute({ userId, completed: false });

    // Then
    expect(await preferences.findByUserId(UserId.reconstitute(userId))).toEqual(
      expect.objectContaining({ currentStreak: 3, longestStreak: 4, lastCompletedDate: todayDate }),
    );
  });

  it("동시에 서로 다른 preference 필드를 바꾸어도 지정하지 않은 값은 보존된다", async () => {
    // Given
    await preferences.create(UserId.reconstitute(userId), {
      timezone: "UTC",
      weatherMorningEnabled: true,
      weatherMorningMinute: 17,
    });
    const lock = await holdRowLock((transaction) =>
      transaction
        .select({ id: userPreference.id })
        .from(userPreference)
        .where(eq(userPreference.userId, userId))
        .for("update"),
    );
    const requests = Promise.allSettled([
      preferences.upsert(UserId.reconstitute(userId), { timezone: "Asia/Seoul" }),
      preferences.upsert(UserId.reconstitute(userId), {
        weatherMorningEnabled: false,
        weatherMorningHour: 0,
        weatherMorningMinute: undefined,
      }),
    ]);

    // When
    try {
      await expectTwoUpdateWaiters("UserPreference");
    } finally {
      await lock.release();
      await requests;
    }

    // Then
    expect((await requests).every((result) => result.status === "fulfilled")).toBe(true);
    expect(await preferences.findByUserId(UserId.reconstitute(userId))).toEqual(
      expect.objectContaining({
        timezone: "Asia/Seoul",
        weatherMorningEnabled: false,
        weatherMorningHour: 0,
        weatherMorningMinute: 17,
        pushEnabled: true,
      }),
    );
  });

  it("일반·push 마케팅 동의의 동시 부분 변경은 서로와 약관을 덮어쓰지 않는다", async () => {
    // Given
    await consents.create(UserId.reconstitute(userId), {
      termsAgreedAt: yesterdayStart,
      privacyAgreedAt: yesterdayStart,
      agreedTermsVersion: "1.0.0",
    });
    const lock = await holdRowLock((transaction) =>
      transaction
        .select({ id: userConsent.id })
        .from(userConsent)
        .where(eq(userConsent.userId, userId))
        .for("update"),
    );
    const requests = Promise.allSettled([
      consents.upsertMarketingConsent(UserId.reconstitute(userId), { agreedAt: now }),
      consents.upsertMarketingPushConsent(UserId.reconstitute(userId), { agreedAt: now }),
    ]);

    // When
    try {
      await expectTwoUpdateWaiters("UserConsent");
    } finally {
      await lock.release();
      await requests;
    }

    // Then
    expect((await requests).every((result) => result.status === "fulfilled")).toBe(true);
    expect(await consents.findByUserId(UserId.reconstitute(userId))).toEqual(
      expect.objectContaining({
        termsAgreedAt: yesterdayStart,
        privacyAgreedAt: yesterdayStart,
        agreedTermsVersion: "1.0.0",
        marketingAgreedAt: now,
        marketingPushAgreedAt: now,
      }),
    );

    // When
    await consents.upsertMarketingConsent(UserId.reconstitute(userId), { agreedAt: null });

    // Then
    expect(await consents.findByUserId(UserId.reconstitute(userId))).toEqual(
      expect.objectContaining({
        marketingAgreedAt: null,
        marketingPushAgreedAt: now,
        termsAgreedAt: yesterdayStart,
      }),
    );
  });

  it("회원 초기 설정은 상위 프로비저닝 transaction 실패 시 사용자·동의와 함께 rollback된다", async () => {
    // Given
    const user = UserFixture.create({
      id: createEntityId(),
      email: "settings-rollback@example.com",
      userTag: "SETPG002",
    });
    const seed = context.module.get(SeedUserSettingsUseCase);

    // When
    const provision = unitOfWork.run(async () => {
      const transaction =
        context.module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost).tx;
      await transaction.insert(userTable).values(user);
      await seed.execute({
        userId: user.id,
        consent: { termsAgreedAt: now, privacyAgreedAt: now, agreedTermsVersion: "1.0.0" },
      });
      throw new Error("프로비저닝 후속 단계 실패");
    });

    // Then
    await expect(provision).rejects.toThrow("프로비저닝 후속 단계 실패");
    expect(await client.query.user.findFirst({ where: { id: user.id } })).toBeUndefined();
    expect(await preferences.findByUserId(UserId.reconstitute(user.id))).toBeNull();
    expect(await consents.findByUserId(UserId.reconstitute(user.id))).toBeNull();
  });
});

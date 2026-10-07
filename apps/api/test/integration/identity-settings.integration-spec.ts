import { TransactionHost } from "@nestjs-cls/transactional";
import sql from "sql-template-tag";
import { vi } from "vitest";

import {
  STREAK_MILESTONE_NOTIFIER,
  type StreakMilestoneNotifierPort,
} from "#api/modules/identity/application/ports/settings/streak-milestone.notifier.port";
import {
  USER_SETTINGS_CACHE,
  type UserSettingsCachePort,
} from "#api/modules/identity/application/ports/settings/user-settings-cache.port";
import { GetPreference } from "#api/modules/identity/application/use-cases/settings/get-preference.use-case";
import { OnTodoToggled } from "#api/modules/identity/application/use-cases/settings/on-todo-toggled.use-case";
import { RefreshPushTimezone } from "#api/modules/identity/application/use-cases/settings/refresh-push-timezone.use-case";
import { SeedUserSettings } from "#api/modules/identity/application/use-cases/settings/seed-user-settings.use-case";
import { UpdatePreference } from "#api/modules/identity/application/use-cases/settings/update-preference.use-case";
import { UpsertPushTimezone } from "#api/modules/identity/application/use-cases/settings/upsert-push-timezone.use-case";
import { UserConsentRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-consent.repository";
import { UserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-preference.repository";
import {
  REMINDER_TIMEZONE_CACHE,
  type ReminderTimezoneCachePort,
} from "#api/modules/notification/notification-reminders-cache.public";
import { encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { createEntityId } from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createTestClient, withDatabaseTransaction } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const at = new Date("2027-01-01T12:00:00.000Z");
const today = new Date("2027-01-01T00:00:00.000Z");
const yesterday = new Date("2026-12-31T00:00:00.000Z");
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
  let preferences: UserPreferenceRepository;
  let consents: UserConsentRepository;
  let unitOfWork: UnitOfWorkPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    preferences = context.module.get(UserPreferenceRepository);
    consents = context.module.get(UserConsentRepository);
    unitOfWork = context.module.get(UNIT_OF_WORK);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "settings-owner@example.com",
      userTag: "SETPG001",
      createdAt: at,
      updatedAt: at,
    });
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function holdRowLock(statement: ReturnType<typeof sql>) {
    const released = Promise.withResolvers<void>();
    const acquired = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (transaction) => {
      await transaction.query(
        sqlStatement(transaction, statement).returnsRow({ id: "pg/text@1" }).build(),
      );
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
        const waiting = await client.runtime().query(
          client.raw.sql`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query ILIKE '%UPDATE%' AND query LIKE ${`%${table}%`}
      `
            .returnsRow({ count: "pg/int4@1" })
            .build(),
        );
        expect(waiting[0]?.count).toBe(2);
      },
      { timeout: 10_000 },
    );
  }

  async function givenCompletedTodos() {
    const category = TodoCategoryFixture.create({ userId });
    await client.orm.public.TodoCategory.create(encodeCreate("TodoCategory", category));
    for (let index = 0; index < 2; index += 1) {
      const todo = TodoFixture.create({
        userId,
        categoryId: category.id,
        startDate: today,
        completed: true,
        completedAt: at,
      });
      await client.orm.public.Todo.create(encodeCreate("Todo", todo));
    }
  }

  it.each([false, true])(
    "weather 부분 변경은 설정 행 존재 여부(%s)와 관계없이 요청값을 저장한다",
    async (exists) => {
      // Given
      if (exists) await preferences.create(userId);

      // When
      const response = await context.module.get(UpdatePreference).execute({ userId, ...weather });
      const saved = await preferences.findByUserId(userId);

      // Then
      expect(response).toEqual(expect.objectContaining(weather));
      expect(saved).toEqual(expect.objectContaining(weather));
      expect(saved?.pushEnabled).toBe(true);
      expect(saved?.nightPushEnabled).toBe(true);
    },
  );

  it("캐시에 저장된 설정도 timezone 자가치유와 upsert 직후 최신 값을 반환한다", async () => {
    // Given
    await preferences.create(userId, { timezone: "UTC" });
    const get = context.module.get(GetPreference);
    expect((await get.execute({ userId })).timezone).toBe("UTC");

    // When
    await context.module.get(RefreshPushTimezone).execute({ userId, timezone: "Asia/Seoul" });

    // Then
    expect((await preferences.findByUserId(userId))?.timezone).toBe("Asia/Seoul");
    expect((await get.execute({ userId })).timezone).toBe("Asia/Seoul");

    // When
    await context.module.get(UpsertPushTimezone).execute({ userId, timezone: "America/New_York" });

    // Then
    expect((await preferences.findByUserId(userId))?.timezone).toBe("America/New_York");
    expect((await get.execute({ userId })).timezone).toBe("America/New_York");
  });

  it("없는 설정과 동일 timezone은 자가치유에서 생성·캐시 무효화를 하지 않는다", async () => {
    // Given
    const cache = context.module.get<UserSettingsCachePort>(USER_SETTINGS_CACHE);
    const invalidatePreference = vi.spyOn(cache, "invalidateUserPreference");
    const reminderTimezoneCache =
      context.module.get<ReminderTimezoneCachePort>(REMINDER_TIMEZONE_CACHE);
    const invalidateTimezones = vi.spyOn(reminderTimezoneCache, "invalidateActiveTimezones");
    const refresh = context.module.get(RefreshPushTimezone);

    // When
    await refresh.execute({ userId, timezone: "UTC" });

    // Then
    expect(await preferences.findByUserId(userId)).toBeNull();
    await preferences.create(userId, { timezone: "UTC" });

    // When
    await refresh.execute({ userId, timezone: "UTC" });

    // Then
    expect(invalidatePreference).not.toHaveBeenCalled();
    expect(invalidateTimezones).not.toHaveBeenCalled();
  });

  it("timezone 전용 최초 생성은 기존 DB push 기본값을 유지한다", async () => {
    // Given
    expect(await preferences.findByUserId(userId)).toBeNull();

    // When
    await preferences.upsertTimezone(userId, "Asia/Seoul");

    // Then
    expect(await preferences.findByUserId(userId)).toEqual(
      expect.objectContaining({
        timezone: "Asia/Seoul",
        pushEnabled: false,
        nightPushEnabled: false,
      }),
    );
  });

  it("같은 날 두 완료 요청의 UPDATE가 대기해도 스트릭과 마일스톤은 한 번 반영된다", async () => {
    // Given
    await preferences.create(userId);
    await client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).update(
      encodePatch("UserPreference", {
        currentStreak: 2,
        longestStreak: 2,
        lastCompletedDate: yesterday,
      }),
    );
    await givenCompletedTodos();
    const notifier = context.module.get<StreakMilestoneNotifierPort>(STREAK_MILESTONE_NOTIFIER);
    const notification = vi.spyOn(notifier, "notifyStreak3Reached").mockImplementation(() => {});
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "UserPreference" WHERE "userId" = ${userId} FOR UPDATE`,
    );
    const useCase = context.module.get(OnTodoToggled);
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
    expect(await preferences.findByUserId(userId)).toEqual(
      expect.objectContaining({ currentStreak: 3, longestStreak: 3, lastCompletedDate: today }),
    );
    expect(notification).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it("늦게 도착한 완료 취소 이벤트는 최신 Todo가 모두 완료된 상태를 되돌리지 않는다", async () => {
    // Given
    await preferences.create(userId);
    await client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).update(
      encodePatch("UserPreference", {
        currentStreak: 3,
        longestStreak: 4,
        lastCompletedDate: today,
      }),
    );
    await givenCompletedTodos();

    // When
    await context.module.get(OnTodoToggled).execute({ userId, completed: false });

    // Then
    expect(await preferences.findByUserId(userId)).toEqual(
      expect.objectContaining({ currentStreak: 3, longestStreak: 4, lastCompletedDate: today }),
    );
  });

  it("동시에 서로 다른 preference 필드를 바꾸어도 지정하지 않은 값은 보존된다", async () => {
    // Given
    await preferences.create(userId, {
      timezone: "UTC",
      weatherMorningEnabled: true,
      weatherMorningMinute: 17,
    });
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "UserPreference" WHERE "userId" = ${userId} FOR UPDATE`,
    );
    const requests = Promise.allSettled([
      preferences.upsert(userId, { timezone: "Asia/Seoul" }),
      preferences.upsert(userId, {
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
    expect(await preferences.findByUserId(userId)).toEqual(
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
    await consents.create(userId, {
      termsAgreedAt: yesterday,
      privacyAgreedAt: yesterday,
      agreedTermsVersion: "1.0.0",
    });
    const lock = await holdRowLock(
      sql`SELECT "id" FROM "UserConsent" WHERE "userId" = ${userId} FOR UPDATE`,
    );
    const requests = Promise.allSettled([
      consents.upsertMarketingConsent(userId, { agreedAt: at }),
      consents.upsertMarketingPushConsent(userId, { agreedAt: at }),
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
    expect(await consents.findByUserId(userId)).toEqual(
      expect.objectContaining({
        termsAgreedAt: yesterday,
        privacyAgreedAt: yesterday,
        agreedTermsVersion: "1.0.0",
        marketingAgreedAt: at,
        marketingPushAgreedAt: at,
      }),
    );

    // When
    await consents.upsertMarketingConsent(userId, { agreedAt: null });

    // Then
    expect(await consents.findByUserId(userId)).toEqual(
      expect.objectContaining({
        marketingAgreedAt: null,
        marketingPushAgreedAt: at,
        termsAgreedAt: yesterday,
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
    const seed = context.module.get(SeedUserSettings);

    // When
    const provision = unitOfWork.run(async () => {
      const transaction =
        context.module.get<TransactionHost<Prisma8TransactionalAdapter>>(TransactionHost).tx;
      await transaction.orm.public.User.create(encodeCreate("User", user));
      await seed.execute({
        userId: user.id,
        consent: { termsAgreedAt: at, privacyAgreedAt: at, agreedTermsVersion: "1.0.0" },
      });
      throw new Error("프로비저닝 후속 단계 실패");
    });

    // Then
    await expect(provision).rejects.toThrow("프로비저닝 후속 단계 실패");
    expect(await client.orm.public.User.where((row) => row.id.eq(user.id)).first()).toBeNull();
    expect(await preferences.findByUserId(user.id)).toBeNull();
    expect(await consents.findByUserId(user.id)).toBeNull();
  });
});

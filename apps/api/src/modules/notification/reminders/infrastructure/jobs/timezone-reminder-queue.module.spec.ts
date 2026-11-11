import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { z } from "zod";

import { PreferenceEntitlementPort } from "#api/modules/identity/preferences/application/ports/preference-entitlement.port";
import { ReminderScheduleEnqueuerPort } from "#api/modules/identity/preferences/application/ports/reminder-schedule-enqueuer.port";
import { ReminderTimezoneCachePort as PreferenceReminderTimezoneCachePort } from "#api/modules/identity/preferences/application/ports/reminder-timezone-cache.port";
import { TodoTimezoneRebaseEnqueuerPort } from "#api/modules/identity/preferences/application/ports/todo-timezone-rebase-enqueuer.port";
import { UserPreferenceRepositoryPort } from "#api/modules/identity/preferences/application/ports/user-preference.repository.port";
import { UserSettingsCachePort } from "#api/modules/identity/preferences/application/ports/user-settings-cache.port";
import { UpsertPushTimezoneUseCase } from "#api/modules/identity/preferences/application/use-cases/upsert-push-timezone.use-case";
import {
  refreshPushTimezoneProvider,
  updatePreferenceProvider,
  upsertPushTimezoneProvider,
} from "#api/modules/identity/preferences/identity-preferences.providers";
import { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { ReminderCacheKey, REMINDER_CACHE_TTL_MS } from "../cache/reminder-cache.keyspace.js";
import { TimezoneReminderQueueModule } from "./timezone-reminder-queue.module.js";

@Global()
@Module({})
class ReminderCacheDependenciesTestModule {}

async function createFixture() {
  const underlyingCache = new InMemoryCacheStore({
    defaultTtlMs: REMINDER_CACHE_TTL_MS,
    maxItems: 10,
  });
  const cache = underlyingCache;
  const settings = createUserSettingsFixture();
  const module = await Test.createTestingModule({
    imports: [
      {
        module: ReminderCacheDependenciesTestModule,
        providers: [
          { provide: CacheStorePort, useValue: cache },
          { provide: JobQueuePort, useValue: new InMemoryJobQueue() },
          {
            provide: ClockPort,
            useValue: new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00Z")),
          },
        ],
        exports: [CacheStorePort, JobQueuePort, ClockPort],
      },
      TimezoneReminderQueueModule,
    ],
    providers: [
      refreshPushTimezoneProvider,
      updatePreferenceProvider,
      upsertPushTimezoneProvider,
      { provide: UserPreferenceRepositoryPort, useValue: settings.preferenceRepository },
      { provide: UserSettingsCachePort, useValue: settings.cache },
      { provide: PreferenceEntitlementPort, useValue: settings.entitlement },
      { provide: PreferenceReminderTimezoneCachePort, useExisting: ReminderTimezoneCachePort },
      { provide: ReminderScheduleEnqueuerPort, useValue: settings.reminderEnqueuer },
      { provide: TodoTimezoneRebaseEnqueuerPort, useValue: settings.todoTimezoneRebase },
      { provide: UnitOfWorkPort, useValue: settings.unitOfWork },
      { provide: ClockPort, useValue: settings.clock },
    ],
  }).compile();
  return {
    cache,
    settings,
    upsertTimezone: module.get(UpsertPushTimezoneUseCase),
    timezoneCache: module.get<ReminderTimezoneCachePort>(ReminderTimezoneCachePort),
    close: () => module.close(),
  };
}

describe("TimezoneReminderQueueModule — 활성 timezone 캐시 capability", () => {
  it("기존 활성 timezone 캐시만 지우고 다음 조회가 새 목록을 로드한다", async () => {
    // Given: 실제 Module이 제공한 Adapter와 실제 CacheStorePort에 이전 목록이 캐시되어 있다.
    const fixture = await createFixture();
    const activeKey = ReminderCacheKey.activeTimezones();
    const unrelatedKey = "settings-fixture:preference";
    try {
      await fixture.cache.set(activeKey, ["UTC"], REMINDER_CACHE_TTL_MS);
      await fixture.cache.set(unrelatedKey, { pushEnabled: true });
      // When: 공개 capability로 목록을 무효화한 뒤 새 목록을 조회한다.
      await fixture.upsertTimezone.execute({
        userId: fixture.settings.userId,
        timezone: "Asia/Seoul",
      });
      const load = vi.fn(async () => ["Asia/Seoul"]);
      const result = await fixture.cache.wrap(
        activeKey,
        z.array(z.string()),
        load,
        REMINDER_CACHE_TTL_MS,
      );
      // Then: 이전 목록을 반환하지 않고 관련 없는 캐시는 보존한다.
      expect(fixture.settings.preferenceRepository.stored(fixture.settings.userId)?.timezone).toBe(
        "Asia/Seoul",
      );
      expect(result).toEqual(["Asia/Seoul"]);
      expect(load).toHaveBeenCalledTimes(1);
      expect(await fixture.cache.get(activeKey, z.unknown())).toEqual(["Asia/Seoul"]);
      expect(await fixture.cache.get(unrelatedKey, z.unknown())).toEqual({ pushEnabled: true });
    } finally {
      await fixture.close();
    }
  });

  it("캐시 삭제 실패를 호출자에게 그대로 전달한다", async () => {
    // Given: 실제 조립된 Adapter의 CacheStorePort 삭제가 실패한다.
    const fixture = await createFixture();
    const failure = new Error("synthetic cache unavailable");
    vi.spyOn(fixture.cache, "del").mockRejectedValueOnce(failure);
    try {
      // When/Then: caller가 기존 실패를 관찰하며 성공으로 처리하지 않는다.
      await expect(fixture.timezoneCache.invalidateActiveTimezones()).rejects.toBe(failure);
    } finally {
      await fixture.close();
    }
  });
});

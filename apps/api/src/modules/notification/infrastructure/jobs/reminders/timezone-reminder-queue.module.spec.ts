import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { mock } from "vitest-mock-extended";

import { PREFERENCE_ENTITLEMENT } from "#api/modules/identity/application/ports/settings/preference-entitlement.port";
import { REMINDER_SCHEDULE_ENQUEUER } from "#api/modules/identity/application/ports/settings/reminder-schedule.enqueuer.port";
import { USER_PREFERENCE_REPOSITORY } from "#api/modules/identity/application/ports/settings/user-preference.repository.port";
import { USER_SETTINGS_CACHE } from "#api/modules/identity/application/ports/settings/user-settings-cache.port";
import { UpsertPushTimezone } from "#api/modules/identity/application/use-cases/settings/upsert-push-timezone.use-case";
import {
  refreshPushTimezoneProvider,
  updatePreferenceProvider,
  upsertPushTimezoneProvider,
} from "#api/modules/identity/identity-settings-application.providers";
import {
  REMINDER_TIMEZONE_CACHE,
  type ReminderTimezoneCachePort,
} from "#api/modules/notification/notification-reminders-cache.public";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import {
  ReminderCacheKey,
  REMINDER_CACHE_TTL_MS,
} from "../../cache/reminders/reminder-cache.keyspace.js";
import { TimezoneReminderQueueModule } from "./timezone-reminder-queue.module.js";

@Global()
@Module({})
class ReminderCacheDependenciesTestModule {}

async function createFixture() {
  const underlyingCache = new InMemoryCacheAdapter({
    defaultTtlMs: REMINDER_CACHE_TTL_MS,
    maxItems: 10,
  });
  const cache = new CacheService(underlyingCache);
  const runtime = mock<JobRuntimePort>();
  const settings = createUserSettingsFixture();
  try {
    const module = await Test.createTestingModule({
      imports: [
        {
          module: ReminderCacheDependenciesTestModule,
          providers: [
            { provide: CacheService, useValue: cache },
            { provide: JOB_RUNTIME, useValue: runtime },
          ],
          exports: [CacheService, JOB_RUNTIME],
        },
        TimezoneReminderQueueModule,
      ],
      providers: [
        refreshPushTimezoneProvider,
        updatePreferenceProvider,
        upsertPushTimezoneProvider,
        { provide: USER_PREFERENCE_REPOSITORY, useValue: settings.preferenceRepository },
        { provide: USER_SETTINGS_CACHE, useValue: settings.cache },
        { provide: PREFERENCE_ENTITLEMENT, useValue: settings.entitlement },
        { provide: REMINDER_SCHEDULE_ENQUEUER, useValue: settings.reminderEnqueuer },
      ],
    }).compile();
    return {
      cache,
      settings,
      upsertTimezone: module.get(UpsertPushTimezone),
      timezoneCache: module.get<ReminderTimezoneCachePort>(REMINDER_TIMEZONE_CACHE),
      async close() {
        try {
          await module.close();
        } finally {
          underlyingCache.onModuleDestroy();
        }
      },
    };
  } catch (error) {
    underlyingCache.onModuleDestroy();
    throw error;
  }
}

describe("TimezoneReminderQueueModule — 활성 timezone 캐시 capability", () => {
  it("기존 활성 timezone 캐시만 지우고 다음 조회가 새 목록을 로드한다", async () => {
    // Given: 실제 Module이 제공한 Adapter와 실제 CacheService에 이전 목록이 캐시되어 있다.
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
      const result = await fixture.cache.wrap(activeKey, load, REMINDER_CACHE_TTL_MS);
      // Then: 이전 목록을 반환하지 않고 관련 없는 캐시는 보존한다.
      expect(
        fixture.settings.preferenceRepository.records.get(fixture.settings.userId)?.timezone,
      ).toBe("Asia/Seoul");
      expect(result).toEqual(["Asia/Seoul"]);
      expect(load).toHaveBeenCalledTimes(1);
      expect(await fixture.cache.get(activeKey)).toEqual(["Asia/Seoul"]);
      expect(await fixture.cache.get(unrelatedKey)).toEqual({ pushEnabled: true });
    } finally {
      await fixture.close();
    }
  });

  it("캐시 삭제 실패를 호출자에게 그대로 전달한다", async () => {
    // Given: 실제 조립된 Adapter의 CacheService 삭제가 실패한다.
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

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  UserSettingsCacheKey,
  USER_SETTINGS_CACHE_TTL_MS,
} from "#api/modules/identity/user-preferences/infrastructure/cache/user-settings-cache.keyspace";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  GenerationGuardedCache,
  type GenerationGuardedCacheKey,
} from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserSettingsCachePort } from "../../application/ports/user-settings-cache.port.js";
import type { PreferenceSettingsReadModel } from "../../application/read-models/preference.read-model.js";

const PREFERENCE_SETTINGS_SCHEMA = z.looseObject({
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  timezone: z.string(),
  locale: z.string().optional(),
  morningReminderHour: z.number(),
  morningReminderMinute: z.number(),
  eveningReminderHour: z.number(),
  eveningReminderMinute: z.number(),
  timeFormat: z.enum(["TWELVE_HOUR", "TWENTY_FOUR_HOUR"]),
  weatherMorningEnabled: z.boolean(),
  weatherMorningHour: z.number(),
  weatherMorningMinute: z.number(),
  weatherEveningEnabled: z.boolean(),
  weatherEveningHour: z.number(),
  weatherEveningMinute: z.number(),
  aiPushEnabled: z.boolean(),
}) satisfies z.ZodType<PreferenceSettingsReadModel>;

function preferenceKey(userId: UserId): GenerationGuardedCacheKey {
  return {
    valueKey: UserSettingsCacheKey.preference(userId.value),
    generationKey: UserSettingsCacheKey.preferenceGeneration(userId.value),
  };
}

// 변경 커밋 전에 읽기 시작한 GET이 무효화 뒤에 옛 설정을 다시 넣지 않게 세대로 막는다
@Injectable()
export class UserSettingsCacheAdapter implements UserSettingsCachePort {
  readonly #preferences: GenerationGuardedCache;

  constructor(cacheService: CacheStorePort) {
    this.#preferences = new GenerationGuardedCache(cacheService, USER_SETTINGS_CACHE_TTL_MS);
  }

  wrapUserPreference(
    userId: UserId,
    factory: () => Promise<PreferenceSettingsReadModel>,
  ): Promise<PreferenceSettingsReadModel> {
    return this.#preferences.wrap(
      preferenceKey(userId),
      PREFERENCE_SETTINGS_SCHEMA,
      factory,
      USER_SETTINGS_CACHE_TTL_MS,
    );
  }

  invalidateUserPreference(userId: UserId): Promise<void> {
    return this.#preferences.invalidate(preferenceKey(userId));
  }
}

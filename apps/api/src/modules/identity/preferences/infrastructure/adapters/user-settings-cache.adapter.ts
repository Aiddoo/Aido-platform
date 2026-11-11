import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  UserSettingsCacheKey,
  USER_SETTINGS_CACHE_TTL_MS,
} from "#api/modules/identity/preferences/infrastructure/cache/user-settings-cache.keyspace";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserSettingsCachePort } from "../../application/ports/user-settings-cache.port.js";
import type { PreferenceSnapshot } from "../../application/read-models/preference.read-model.js";

const PREFERENCE_SNAPSHOT_SCHEMA = z.looseObject({
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
}) satisfies z.ZodType<PreferenceSnapshot>;

@Injectable()
export class UserSettingsCacheAdapter implements UserSettingsCachePort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    this.#cacheService = cacheService;
  }

  wrapUserPreference(
    userId: UserId,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot> {
    return this.#cacheService.wrap(
      UserSettingsCacheKey.preference(userId.value),
      PREFERENCE_SNAPSHOT_SCHEMA,
      factory,
      USER_SETTINGS_CACHE_TTL_MS,
    );
  }

  invalidateUserPreference(userId: UserId): Promise<void> {
    return this.#cacheService.del(UserSettingsCacheKey.preference(userId.value));
  }
}

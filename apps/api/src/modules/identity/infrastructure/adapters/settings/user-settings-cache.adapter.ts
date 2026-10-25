import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  UserSettingsCacheKey,
  USER_SETTINGS_CACHE_TTL_MS,
} from "#api/modules/identity/infrastructure/cache/settings/user-settings-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { UserSettingsCachePort } from "../../../application/ports/settings/user-settings-cache.port.js";
import type { PreferenceSnapshot } from "../../../application/read-models/settings/preference.read-model.js";

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
  constructor(private readonly cacheService: CacheService) {}

  wrapUserPreference(
    userId: string,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot> {
    return this.cacheService.wrap(
      UserSettingsCacheKey.preference(userId),
      PREFERENCE_SNAPSHOT_SCHEMA,
      factory,
      USER_SETTINGS_CACHE_TTL_MS,
    );
  }

  invalidateUserPreference(userId: string): Promise<void> {
    return this.cacheService.del(UserSettingsCacheKey.preference(userId));
  }
}

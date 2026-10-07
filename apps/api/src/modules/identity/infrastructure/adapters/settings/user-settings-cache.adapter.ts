import { Injectable } from "@nestjs/common";

import {
  UserSettingsCacheKey,
  USER_SETTINGS_CACHE_TTL_MS,
} from "#api/modules/identity/infrastructure/cache/settings/user-settings-cache.keyspace";
import { ReminderCacheKey } from "#api/modules/notification/infrastructure/cache/reminders/reminder-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { UserSettingsCachePort } from "../../../application/ports/settings/user-settings-cache.port.js";
import type { PreferenceSnapshot } from "../../../application/read-models/settings/preference.read-model.js";

@Injectable()
export class UserSettingsCacheAdapter implements UserSettingsCachePort {
  constructor(private readonly cacheService: CacheService) {}

  wrapUserPreference(
    userId: string,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot> {
    return this.cacheService.wrap(
      UserSettingsCacheKey.preference(userId),
      factory,
      USER_SETTINGS_CACHE_TTL_MS,
    );
  }

  invalidateUserPreference(userId: string): Promise<void> {
    return this.cacheService.del(UserSettingsCacheKey.preference(userId));
  }

  invalidateActiveTimezones(): Promise<void> {
    return this.cacheService.del(ReminderCacheKey.activeTimezones());
  }
}

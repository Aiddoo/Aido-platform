import { Inject, Injectable } from "@nestjs/common";

import {
  type UserPreferenceCacheInvalidatorPort,
  UserSettingsCachePort,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceCachePort } from "../../application/ports/user-preference-cache.port.js";

@Injectable()
export class UserPreferenceCacheAdapter implements UserPreferenceCachePort {
  readonly #preferenceCache: UserPreferenceCacheInvalidatorPort;

  constructor(
    @Inject(UserSettingsCachePort)
    preferenceCache: UserPreferenceCacheInvalidatorPort,
  ) {
    this.#preferenceCache = preferenceCache;
  }

  invalidateUserPreference(userId: UserId): Promise<void> {
    return this.#preferenceCache.invalidateUserPreference(userId);
  }
}

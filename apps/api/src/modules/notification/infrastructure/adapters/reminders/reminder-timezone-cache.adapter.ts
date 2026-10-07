import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

import type { ReminderTimezoneCachePort } from "../../../application/ports/reminders/reminder-timezone-cache.port.js";
import { ReminderCacheKey } from "../../cache/reminders/reminder-cache.keyspace.js";

@Injectable()
export class ReminderTimezoneCacheAdapter implements ReminderTimezoneCachePort {
  readonly #cache: Pick<CacheService, "del">;

  constructor(cache: CacheService) {
    this.#cache = cache;
  }

  invalidateActiveTimezones(): Promise<void> {
    return this.#cache.del(ReminderCacheKey.activeTimezones());
  }
}

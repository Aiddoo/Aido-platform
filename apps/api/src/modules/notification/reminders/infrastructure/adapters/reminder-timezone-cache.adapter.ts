import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

import { ReminderTimezoneCachePort } from "../../application/ports/reminder-timezone-cache.port.js";
import { ReminderCacheKey } from "../cache/reminder-cache.keyspace.js";

@Injectable()
export class ReminderTimezoneCacheAdapter extends ReminderTimezoneCachePort {
  readonly #cache: Pick<CacheService, "del">;

  constructor(cache: CacheService) {
    super();
    this.#cache = cache;
  }

  invalidateActiveTimezones(): Promise<void> {
    return this.#cache.del(ReminderCacheKey.activeTimezones());
  }
}

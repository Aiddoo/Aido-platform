import { Injectable } from "@nestjs/common";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import { ReminderTimezoneCachePort } from "../../application/ports/reminder-timezone-cache.port.js";
import { ReminderCacheKey } from "../cache/reminder-cache.keyspace.js";

@Injectable()
export class ReminderTimezoneCacheAdapter extends ReminderTimezoneCachePort {
  readonly #cache: Pick<CacheStorePort, "del">;

  constructor(cache: CacheStorePort) {
    super();
    this.#cache = cache;
  }

  invalidateActiveTimezones(): Promise<void> {
    return this.#cache.del(ReminderCacheKey.activeTimezones());
  }
}

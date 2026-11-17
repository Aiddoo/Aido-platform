import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  ReminderCacheKey,
  REMINDER_CACHE_TTL_MS,
} from "#api/modules/notification/reminders/infrastructure/cache/reminder-cache.keyspace";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userPreference } from "#api/platform/database/schema/index";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

import { resolveRecipientLocale } from "../../../shared/domain/recipient-locale.domain-service.js";
import type { SchedulerPreferenceReaderPort } from "../../application/ports/scheduler-preference-reader.port.js";
import type { UserLocaleMapReadModel } from "../../application/read-models/scheduler.read-model.js";

@Injectable()
export class DrizzleSchedulerPreferenceReader implements SchedulerPreferenceReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #cacheService: CacheStorePort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    cacheService: CacheStorePort,
  ) {
    this.#transactionHost = transactionHost;
    this.#cacheService = cacheService;
  }

  async findActiveTimezones(): Promise<string[]> {
    return this.#cacheService.wrap(
      ReminderCacheKey.activeTimezones(),
      z.array(z.string()),
      async (): Promise<string[]> => {
        const rows = await this.#db
          .selectDistinct({ timezone: userPreference.timezone })
          .from(userPreference);
        return rows.flatMap((row) =>
          normalizeIanaTimezone(row.timezone) != null ? [row.timezone] : [],
        );
      },
      REMINDER_CACHE_TTL_MS,
    );
  }

  async findUserLocales(userIds: string[]): Promise<UserLocaleMapReadModel> {
    if (userIds.length === 0) {
      return new Map();
    }
    const preferences = await this.#db.query.userPreference.findMany({
      columns: { userId: true, locale: true },
      where: { userId: { in: userIds } },
    });
    return new Map(
      preferences.map((preference) => [
        preference.userId,
        resolveRecipientLocale({ storedLocale: preference.locale, lastRequestLocale: null }),
      ]),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

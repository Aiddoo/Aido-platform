import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { userDeliveryPreference } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

import {
  type RecipientLocaleOf,
  recipientLocaleOf,
} from "../../../shared/domain/recipient-locale.domain-service.js";
import type { SchedulerPreferenceReaderPort } from "../../application/ports/scheduler-preference-reader.port.js";
import { ReminderCacheKey, REMINDER_CACHE_TTL_MS } from "../cache/reminder-cache.keyspace.js";

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
    return this.#cacheService.wrap({
      key: ReminderCacheKey.activeTimezones(),
      schema: z.array(z.string()),
      factory: async (): Promise<string[]> => {
        const preference = userDeliveryPreference();
        const rows = await this.#db
          .selectDistinct({ timezone: preference.timezone })
          .from(preference);
        return rows.flatMap((row) =>
          normalizeIanaTimezone(row.timezone) != null ? [row.timezone] : [],
        );
      },
      ttlMs: REMINDER_CACHE_TTL_MS,
    });
  }

  async getUserLocales(userIds: readonly UserId[]): Promise<RecipientLocaleOf> {
    if (userIds.length === 0) {
      return recipientLocaleOf(new Map());
    }
    const preference = userDeliveryPreference();
    const preferences = await this.#db
      .select({ userId: preference.userId, locale: preference.locale })
      .from(preference)
      .where(
        inArray(
          preference.userId,
          userIds.map((userId) => userId.value),
        ),
      );
    return recipientLocaleOf(
      new Map(preferences.map((preference) => [preference.userId, preference.locale])),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

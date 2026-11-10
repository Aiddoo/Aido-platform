import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userPreference } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type PreferenceWriteInput,
  UserPreferenceRepositoryPort,
} from "../../application/ports/user-preference.repository.port.js";
import type { StreakState } from "../../domain/streak.vo.js";
import { UserPreference } from "../../domain/user-preference.aggregate.js";

type UserPreferenceRow = typeof userPreference.$inferSelect;
type UserPreferencePatch = Partial<Omit<typeof userPreference.$inferInsert, "id" | "userId">>;

@Injectable()
export class DrizzleUserPreferenceRepository extends UserPreferenceRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByUserId(userId: UserId): Promise<UserPreferenceRow | null> {
    const row = await this.#db.query.userPreference.findFirst({
      where: { userId: userId.value },
    });
    return row ?? null;
  }

  async findStreakByUserId(userId: UserId): Promise<UserPreference | null> {
    const row = await this.#db.query.userPreference.findFirst({
      columns: { userId: true, currentStreak: true, longestStreak: true, lastCompletedDate: true },
      where: { userId: userId.value },
    });
    return row == null ? null : UserPreference.reconstitute(row);
  }

  async findByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceRow[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.#db.query.userPreference.findMany({
      where: { userId: { in: userIds.map((userId) => userId.value) } },
    });
  }

  async create(userId: UserId, data: PreferenceWriteInput = {}): Promise<UserPreferenceRow> {
    const [row] = await this.#db
      .insert(userPreference)
      .values({ userId: userId.value, ...this.#createFields(data) })
      .returning();
    return requireRecord(row);
  }

  async upsert(userId: UserId, data: PreferenceWriteInput): Promise<UserPreferenceRow> {
    return this.#upsert(userId.value, this.#createFields(data), this.#writeFields(data));
  }

  async updateStreakIfUnchanged(
    userId: UserId,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean> {
    const updated = await this.#db
      .update(userPreference)
      .set(next)
      .where(
        and(
          eq(userPreference.userId, userId.value),
          eq(userPreference.currentStreak, expected.currentStreak),
          eq(userPreference.longestStreak, expected.longestStreak),
          expected.lastCompletedDate == null
            ? isNull(userPreference.lastCompletedDate)
            : eq(userPreference.lastCompletedDate, expected.lastCompletedDate),
        ),
      )
      .returning({ id: userPreference.id });
    return updated.length === 1;
  }

  async upsertTimezone(userId: UserId, timezone: string): Promise<boolean> {
    const written = await this.#db
      .insert(userPreference)
      .values({ userId: userId.value, timezone })
      .onConflictDoUpdate({
        target: userPreference.userId,
        set: { timezone },
        where: ne(userPreference.timezone, timezone),
      })
      .returning({ id: userPreference.id });
    return written.length > 0;
  }

  async refreshTimezoneIfChanged(userId: UserId, timezone: string): Promise<number> {
    const updated = await this.#db
      .update(userPreference)
      .set({ timezone })
      .where(and(eq(userPreference.userId, userId.value), ne(userPreference.timezone, timezone)))
      .returning({ id: userPreference.id });
    return updated.length;
  }

  async upsertLocale(userId: UserId, locale: string): Promise<void> {
    await this.#upsert(userId.value, { locale }, { locale });
  }

  async #upsert(
    userId: string,
    create: UserPreferencePatch,
    update: UserPreferencePatch,
  ): Promise<UserPreferenceRow> {
    const [row] = await this.#db
      .insert(userPreference)
      .values({ userId, ...create })
      // userId는 변경할 필드가 없을 때도 UPDATE가 성립하게 하는 무변경 값이다.
      .onConflictDoUpdate({ target: userPreference.userId, set: { userId, ...update } })
      .returning();
    return requireRecord(row);
  }

  #createFields(data: PreferenceWriteInput): UserPreferencePatch {
    return {
      ...this.#writeFields(data),
      pushEnabled: data.pushEnabled ?? true,
      nightPushEnabled: data.nightPushEnabled ?? true,
    };
  }

  #writeFields(data: PreferenceWriteInput): UserPreferencePatch {
    return {
      pushEnabled: data.pushEnabled,
      nightPushEnabled: data.nightPushEnabled,
      timezone: data.timezone,
      morningReminderHour: data.morningReminderHour,
      morningReminderMinute: data.morningReminderMinute,
      eveningReminderHour: data.eveningReminderHour,
      eveningReminderMinute: data.eveningReminderMinute,
      timeFormat: data.timeFormat,
      weatherMorningEnabled: data.weatherMorningEnabled,
      weatherMorningHour: data.weatherMorningHour,
      weatherMorningMinute: data.weatherMorningMinute,
      weatherEveningEnabled: data.weatherEveningEnabled,
      weatherEveningHour: data.weatherEveningHour,
      weatherEveningMinute: data.weatherEveningMinute,
    };
  }
}

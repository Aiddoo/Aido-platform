import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseDate, varchar } from "#api/platform/database/database-values";
import type { UserPreference } from "#api/platform/database/database.types";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  PreferenceWriteInput,
  UserPreferenceRepositoryPort,
} from "../../../application/ports/settings/user-preference.repository.port.js";
import type { StreakState } from "../../../domain/value-objects/settings/streak.vo.js";

@Injectable()
export class UserPreferenceRepository implements UserPreferenceRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserPreference | null> {
    return this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId))
      .first()
      .then((row) => decodeRecord("UserPreference", row));
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserPreference[]> {
    if (userIds.length === 0) return [];
    return this.client.orm.public.UserPreference.where((row) => row.userId.in([...userIds]))
      .all()
      .then((rows) => decodeRecord("UserPreference", rows));
  }

  async create(userId: string, data: PreferenceWriteInput = {}): Promise<UserPreference> {
    return this.client.orm.public.UserPreference.create(
      encodeCreate("UserPreference", this.#createFields(userId, data)),
    ).then((row) => decodeRecord("UserPreference", row));
  }

  async upsert(userId: string, data: PreferenceWriteInput): Promise<UserPreference> {
    return this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserPreference", { userId }),
        create: encodeCreate("UserPreference", this.#createFields(userId, data)),
        update: encodePatch("UserPreference", this.#writeFields(data)),
      })
      .then((row) => decodeRecord("UserPreference", row));
  }

  async updateStreakIfUnchanged(
    userId: string,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean> {
    const updated = await this.client.orm.public.UserPreference.where((row) =>
      and(
        row.userId.eq(userId),
        row.currentStreak.eq(expected.currentStreak),
        row.longestStreak.eq(expected.longestStreak),
        expected.lastCompletedDate === null
          ? row.lastCompletedDate.isNull()
          : row.lastCompletedDate.eq(databaseDate(expected.lastCompletedDate)),
      ),
    ).updateAndCount(encodePatch("UserPreference", next));
    return updated === 1;
  }

  async upsertTimezone(userId: string, timezone: string): Promise<void> {
    await this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).upsert({
      conflictOn: encodePatch("UserPreference", { userId }),
      create: encodeCreate("UserPreference", { userId, timezone }),
      update: encodePatch("UserPreference", { timezone }),
    });
  }

  async refreshTimezoneIfChanged(userId: string, timezone: string): Promise<number> {
    return this.client.orm.public.UserPreference.where((row) =>
      and(row.userId.eq(userId), row.timezone.neq(varchar(timezone, 50))),
    ).updateAndCount(encodePatch("UserPreference", { timezone }));
  }

  async upsertLocale(userId: string, locale: string): Promise<void> {
    await this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).upsert({
      conflictOn: encodePatch("UserPreference", { userId }),
      create: encodeCreate("UserPreference", { userId, locale }),
      update: encodePatch("UserPreference", { locale }),
    });
  }

  #createFields(userId: string, data: PreferenceWriteInput) {
    return {
      userId,
      ...this.#writeFields(data),
      pushEnabled: data.pushEnabled ?? true,
      nightPushEnabled: data.nightPushEnabled ?? true,
    };
  }

  #writeFields(data: PreferenceWriteInput) {
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

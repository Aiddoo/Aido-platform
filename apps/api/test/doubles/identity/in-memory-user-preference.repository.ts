import { pickBy } from "es-toolkit";

import {
  type PreferenceWriteInput,
  type UserPreferenceRecordWithId,
  UserPreferenceRepositoryPort,
} from "#api/modules/identity/preferences/application/ports/user-preference.repository.port";
import type { StreakState } from "#api/modules/identity/preferences/domain/streak.vo";
import { UserPreference } from "#api/modules/identity/preferences/domain/user-preference.aggregate";
import type { UserPreferenceRecord } from "#api/modules/identity/preferences/domain/user-preference.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// UserPreference 테이블의 열 기본값과 같다
const COLUMN_DEFAULTS: UserPreferenceRecord = {
  pushEnabled: true,
  nightPushEnabled: true,
  timezone: "UTC",
  locale: "ko",
  morningReminderHour: 8,
  morningReminderMinute: 0,
  eveningReminderHour: 19,
  eveningReminderMinute: 0,
  timeFormat: "TWELVE_HOUR",
  weatherMorningEnabled: true,
  weatherMorningHour: 7,
  weatherMorningMinute: 0,
  weatherEveningEnabled: true,
  weatherEveningHour: 17,
  weatherEveningMinute: 30,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};

function copyOf(record: UserPreferenceRecordWithId): UserPreferenceRecordWithId {
  return { ...record };
}

function definedFields(data: PreferenceWriteInput): PreferenceWriteInput {
  return pickBy(data, (value) => value !== undefined);
}

export class InMemoryUserPreferenceRepository extends UserPreferenceRepositoryPort {
  readonly #records = new Map<string, UserPreferenceRecordWithId>();

  constructor(records: readonly UserPreferenceRecordWithId[] = []) {
    super();
    for (const record of records) {
      this.#records.set(record.userId, copyOf(record));
    }
  }

  get all(): readonly UserPreferenceRecordWithId[] {
    return [...this.#records.values()].map(copyOf);
  }

  stored(userId: string): UserPreferenceRecordWithId | undefined {
    const record = this.#records.get(userId);
    return record == null ? undefined : copyOf(record);
  }

  async findByUserId(userId: UserId): Promise<UserPreferenceRecordWithId | null> {
    return this.stored(userId.value) ?? null;
  }

  async findStreakByUserId(userId: UserId): Promise<UserPreference | null> {
    const record = this.#records.get(userId.value);
    return record == null
      ? null
      : UserPreference.reconstitute({
          userId: userId.value,
          currentStreak: record.currentStreak,
          longestStreak: record.longestStreak,
          lastCompletedDate: record.lastCompletedDate,
        });
  }

  async findByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceRecordWithId[]> {
    return this.all.filter((record) => userIds.some((userId) => userId.value === record.userId));
  }

  async create(
    userId: UserId,
    data: PreferenceWriteInput = {},
  ): Promise<UserPreferenceRecordWithId> {
    if (this.#records.has(userId.value)) {
      throw new Error(`UserPreference already exists for ${userId.value}`);
    }
    return this.#write({ ...COLUMN_DEFAULTS, ...definedFields(data), userId: userId.value });
  }

  async upsert(userId: UserId, data: PreferenceWriteInput): Promise<UserPreferenceRecordWithId> {
    const existing = this.#records.get(userId.value);
    return existing == null
      ? this.create(userId, data)
      : this.#write({ ...existing, ...definedFields(data) });
  }

  async upsertTimezone(userId: UserId, timezone: string): Promise<boolean> {
    const existing = this.#records.get(userId.value);
    if (existing?.timezone === timezone) {
      return false;
    }
    this.#write({ ...(existing ?? { ...COLUMN_DEFAULTS, userId: userId.value }), timezone });
    return true;
  }

  async refreshTimezoneIfChanged(userId: UserId, timezone: string): Promise<number> {
    const existing = this.#records.get(userId.value);
    if (existing == null || existing.timezone === timezone) {
      return 0;
    }
    this.#write({ ...existing, timezone });
    return 1;
  }

  async upsertLocale(userId: UserId, locale: string): Promise<void> {
    this.#write({
      ...(this.#records.get(userId.value) ?? { ...COLUMN_DEFAULTS, userId: userId.value }),
      locale,
    });
  }

  async updateStreakIfUnchanged(
    userId: UserId,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean> {
    const existing = this.#records.get(userId.value);
    if (
      existing == null ||
      existing.currentStreak !== expected.currentStreak ||
      existing.longestStreak !== expected.longestStreak ||
      existing.lastCompletedDate?.toString() !== expected.lastCompletedDate?.toString()
    ) {
      return false;
    }
    this.#write({ ...existing, ...next });
    return true;
  }

  #write(record: UserPreferenceRecordWithId): UserPreferenceRecordWithId {
    this.#records.set(record.userId, copyOf(record));
    return copyOf(record);
  }
}

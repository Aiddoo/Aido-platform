import { pickBy } from "es-toolkit";

import {
  type PreferenceWriteInput,
  type UserPreferenceRecordWithId,
  UserPreferenceRepositoryPort,
} from "#api/modules/identity/preferences/application/ports/user-preference.repository.port";
import type { StreakState } from "#api/modules/identity/preferences/domain/streak.vo";
import { UserPreference } from "#api/modules/identity/preferences/domain/user-preference.aggregate";
import type { UserPreferenceRecord } from "#api/modules/identity/preferences/domain/user-preference.constants";

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

  async findByUserId(userId: string): Promise<UserPreferenceRecordWithId | null> {
    return this.stored(userId) ?? null;
  }

  async findStreakByUserId(userId: string): Promise<UserPreference | null> {
    const record = this.#records.get(userId);
    return record == null
      ? null
      : UserPreference.reconstitute({
          userId,
          currentStreak: record.currentStreak,
          longestStreak: record.longestStreak,
          lastCompletedDate: record.lastCompletedDate,
        });
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserPreferenceRecordWithId[]> {
    return this.all.filter((record) => userIds.includes(record.userId));
  }

  async create(
    userId: string,
    data: PreferenceWriteInput = {},
  ): Promise<UserPreferenceRecordWithId> {
    if (this.#records.has(userId)) {
      throw new Error(`UserPreference already exists for ${userId}`);
    }
    return this.#write({ ...COLUMN_DEFAULTS, ...definedFields(data), userId });
  }

  async upsert(userId: string, data: PreferenceWriteInput): Promise<UserPreferenceRecordWithId> {
    const existing = this.#records.get(userId);
    return existing == null
      ? this.create(userId, data)
      : this.#write({ ...existing, ...definedFields(data) });
  }

  async upsertTimezone(userId: string, timezone: string): Promise<boolean> {
    const existing = this.#records.get(userId);
    if (existing?.timezone === timezone) {
      return false;
    }
    this.#write({ ...(existing ?? { ...COLUMN_DEFAULTS, userId }), timezone });
    return true;
  }

  async refreshTimezoneIfChanged(userId: string, timezone: string): Promise<number> {
    const existing = this.#records.get(userId);
    if (existing == null || existing.timezone === timezone) {
      return 0;
    }
    this.#write({ ...existing, timezone });
    return 1;
  }

  async upsertLocale(userId: string, locale: string): Promise<void> {
    this.#write({ ...(this.#records.get(userId) ?? { ...COLUMN_DEFAULTS, userId }), locale });
  }

  async updateStreakIfUnchanged(
    userId: string,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean> {
    const existing = this.#records.get(userId);
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

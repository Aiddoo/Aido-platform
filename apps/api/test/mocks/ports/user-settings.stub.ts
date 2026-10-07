import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";
import { pickBy } from "es-toolkit";

import type { PreferenceEntitlementPort } from "#api/modules/identity/application/ports/settings/preference-entitlement.port";
import type {
  ReminderHourChangedPayload,
  ReminderScheduleEnqueuerPort,
} from "#api/modules/identity/application/ports/settings/reminder-schedule.enqueuer.port";
import type { StreakMilestoneNotifierPort } from "#api/modules/identity/application/ports/settings/streak-milestone.notifier.port";
import type {
  TodoCompletionStats,
  TodoCompletionStatsReaderPort,
} from "#api/modules/identity/application/ports/settings/todo-completion-stats.reader.port";
import type {
  ConsentSeedInput,
  UserConsentRecordWithId,
  UserConsentRepositoryPort,
} from "#api/modules/identity/application/ports/settings/user-consent.repository.port";
import type {
  PreferenceWriteInput,
  UserPreferenceRecordWithId,
  UserPreferenceRepositoryPort,
} from "#api/modules/identity/application/ports/settings/user-preference.repository.port";
import type { UserSettingsCachePort } from "#api/modules/identity/application/ports/settings/user-settings-cache.port";
import type { PreferenceSnapshot } from "#api/modules/identity/application/read-models/settings/preference.read-model";
import type { UserConsentRecord } from "#api/modules/identity/domain/records/settings/user-consent.record";
import type { UserPreferenceRecord } from "#api/modules/identity/domain/records/settings/user-preference.record";
import type { StreakState } from "#api/modules/identity/domain/value-objects/settings/streak.vo";
import { UserPreferenceBuilder } from "#test/builders/user-preference.builder";

export class StubUserPreferenceRepository implements UserPreferenceRepositoryPort {
  readonly records: Map<string, UserPreferenceRecord>;
  readonly reads: string[] = [];
  readonly batchReads: Array<readonly string[]> = [];
  readonly streakAttempts: { userId: string; expected: StreakState; next: StreakState }[] = [];

  constructor(records: readonly (readonly [string, UserPreferenceRecord])[] = []) {
    this.records = new Map(records.map(([userId, record]) => [userId, { ...record }]));
  }

  async findByUserId(userId: string): Promise<UserPreferenceRecord | null> {
    this.reads.push(userId);
    const record = this.records.get(userId);
    return record === undefined
      ? null
      : {
          ...record,
          lastCompletedDate:
            record.lastCompletedDate === null ? null : new Date(record.lastCompletedDate),
        };
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserPreferenceRecordWithId[]> {
    this.batchReads.push([...userIds]);
    return [...this.records.entries()]
      .filter(([userId]) => userIds.includes(userId))
      .map(([userId, record]) => ({ ...record, userId }));
  }

  async create(userId: string, data: PreferenceWriteInput = {}): Promise<UserPreferenceRecord> {
    const record = {
      ...this.#defaults(userId),
      pushEnabled: true,
      nightPushEnabled: true,
      ...pickBy(data, (value) => value !== undefined),
    };
    this.records.set(userId, record);
    return { ...record };
  }

  async upsert(userId: string, data: PreferenceWriteInput): Promise<UserPreferenceRecord> {
    const existing = this.records.get(userId);
    if (existing === undefined) return this.create(userId, data);
    const record = { ...existing, ...pickBy(data, (value) => value !== undefined) };
    this.records.set(userId, record);
    return { ...record };
  }

  async upsertTimezone(userId: string, timezone: string): Promise<void> {
    this.records.set(userId, { ...(this.records.get(userId) ?? this.#defaults(userId)), timezone });
  }

  async refreshTimezoneIfChanged(userId: string, timezone: string): Promise<number> {
    const existing = this.records.get(userId);
    if (existing === undefined || existing.timezone === timezone) return 0;
    this.records.set(userId, { ...existing, timezone });
    return 1;
  }

  async upsertLocale(userId: string, locale: string): Promise<void> {
    this.records.set(userId, { ...(this.records.get(userId) ?? this.#defaults(userId)), locale });
  }

  async updateStreakIfUnchanged(
    userId: string,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean> {
    this.streakAttempts.push({ userId, expected, next });
    const record = this.records.get(userId);
    if (
      record === undefined ||
      record.currentStreak !== expected.currentStreak ||
      record.longestStreak !== expected.longestStreak ||
      record.lastCompletedDate?.getTime() !== expected.lastCompletedDate?.getTime()
    )
      return false;
    this.records.set(userId, {
      ...record,
      ...next,
      lastCompletedDate: next.lastCompletedDate === null ? null : new Date(next.lastCompletedDate),
    });
    return true;
  }

  #defaults(userId: string): UserPreferenceRecord {
    return {
      ...UserPreferenceBuilder.create(userId).build(),
      pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
      nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
      morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
      eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
      weatherMorningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
      weatherEveningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
      weatherEveningHour: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_HOUR,
      weatherEveningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
    };
  }
}

export class StubUserConsentRepository implements UserConsentRepositoryPort {
  readonly records: Map<string, UserConsentRecord>;
  readonly batchReads: Array<readonly string[]> = [];
  constructor(records: readonly (readonly [string, UserConsentRecord])[] = []) {
    this.records = new Map(records.map(([userId, record]) => [userId, { ...record }]));
  }

  async findByUserId(userId: string): Promise<UserConsentRecord | null> {
    const record = this.records.get(userId);
    return record === undefined ? null : { ...record };
  }
  async findByUserIds(userIds: readonly string[]): Promise<UserConsentRecordWithId[]> {
    this.batchReads.push([...userIds]);
    return [...this.records.entries()]
      .filter(([userId]) => userIds.includes(userId))
      .map(([userId, record]) => ({ ...record, userId }));
  }
  async create(userId: string, input: ConsentSeedInput): Promise<UserConsentRecord> {
    const record = {
      termsAgreedAt: input.termsAgreedAt ?? null,
      privacyAgreedAt: input.privacyAgreedAt ?? null,
      agreedTermsVersion: input.agreedTermsVersion ?? null,
      marketingAgreedAt: input.marketingAgreedAt ?? null,
      marketingPushAgreedAt: input.marketingPushAgreedAt ?? null,
    };
    this.records.set(userId, record);
    return { ...record };
  }
  async upsertMarketingConsent(
    userId: string,
    input: { agreedAt: Date | null },
  ): Promise<UserConsentRecord> {
    const record = this.#existingOrCreate(userId);
    const updated = {
      ...record,
      marketingAgreedAt: input.agreedAt === null ? null : new Date(input.agreedAt),
    };
    this.records.set(userId, updated);
    return { ...updated };
  }
  async upsertMarketingPushConsent(
    userId: string,
    input: { agreedAt: Date | null },
  ): Promise<UserConsentRecord> {
    const record = this.#existingOrCreate(userId);
    const updated = {
      ...record,
      marketingPushAgreedAt: input.agreedAt === null ? null : new Date(input.agreedAt),
    };
    this.records.set(userId, updated);
    return { ...updated };
  }
  #existingOrCreate(userId: string): UserConsentRecord {
    return (
      this.records.get(userId) ?? {
        termsAgreedAt: null,
        privacyAgreedAt: null,
        agreedTermsVersion: null,
        marketingAgreedAt: null,
        marketingPushAgreedAt: null,
      }
    );
  }
}

export class StubUserSettingsCache implements UserSettingsCachePort {
  readonly snapshots = new Map<string, PreferenceSnapshot>();
  readonly activeTimezones = new Set<string>();
  activeTimezoneInvalidations = 0;
  async wrapUserPreference(
    userId: string,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot> {
    const snapshot = this.snapshots.get(userId);
    if (snapshot !== undefined) return snapshot;
    const loaded = await factory();
    this.snapshots.set(userId, loaded);
    return loaded;
  }
  async invalidateUserPreference(userId: string): Promise<void> {
    this.snapshots.delete(userId);
  }
  async invalidateActiveTimezones(): Promise<void> {
    this.activeTimezoneInvalidations += 1;
    this.activeTimezones.clear();
  }
}

export class StubPreferenceEntitlement implements PreferenceEntitlementPort {
  readonly premiumUserIds = new Set<string>();
  async hasPremiumAccess(userId: string): Promise<boolean> {
    return this.premiumUserIds.has(userId);
  }
}

export class StubReminderScheduleEnqueuer implements ReminderScheduleEnqueuerPort {
  readonly jobs: ReminderHourChangedPayload[] = [];
  enqueueReminderHourChanged(payload: ReminderHourChangedPayload): void {
    this.jobs.push({ ...payload });
  }
}
export class StubStreakMilestoneNotifier implements StreakMilestoneNotifierPort {
  readonly userIds: string[] = [];
  notifyStreak3Reached(userId: string): void {
    this.userIds.push(userId);
  }
}
export class StubTodoCompletionStatsReader implements TodoCompletionStatsReaderPort {
  readonly days = new Map<string, TodoCompletionStats>();
  readonly queries: { userId: string; dayStart: Date; dayEnd: Date }[] = [];
  async countForDay(userId: string, dayStart: Date, dayEnd: Date): Promise<TodoCompletionStats> {
    this.queries.push({ userId, dayStart: new Date(dayStart), dayEnd: new Date(dayEnd) });
    return (
      this.days.get(`${userId}/${dayStart.toISOString().slice(0, 10)}`) ?? {
        total: 0,
        completed: 0,
      }
    );
  }
}

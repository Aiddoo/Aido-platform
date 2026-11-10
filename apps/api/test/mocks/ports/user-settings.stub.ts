import type { PremiumFeature } from "@aido/api/vocabulary";
import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";
import { pickBy } from "es-toolkit";

import type { PreferenceEntitlementPort } from "#api/modules/identity/preferences/application/ports/preference-entitlement.port";
import type {
  ReminderHourChangedPayload,
  ReminderScheduleEnqueuerPort,
} from "#api/modules/identity/preferences/application/ports/reminder-schedule-enqueuer.port";
import type { StreakMilestoneNotifierPort } from "#api/modules/identity/preferences/application/ports/streak-milestone-notifier.port";
import type {
  TodoCompletionStats,
  TodoCompletionStatsReaderPort,
} from "#api/modules/identity/preferences/application/ports/todo-completion-stats.reader.port";
import type { TodoTimezoneRebaseEnqueuerPort } from "#api/modules/identity/preferences/application/ports/todo-timezone-rebase-enqueuer.port";
import type {
  ConsentSeedInput,
  MarketingReconfirmTarget,
  UserConsentRecordWithId,
  UserConsentRepositoryPort,
} from "#api/modules/identity/preferences/application/ports/user-consent.repository.port";
import type {
  PreferenceWriteInput,
  UserPreferenceRecordWithId,
  UserPreferenceRepositoryPort,
} from "#api/modules/identity/preferences/application/ports/user-preference.repository.port";
import type { UserSettingsCachePort } from "#api/modules/identity/preferences/application/ports/user-settings-cache.port";
import type { PreferenceSnapshot } from "#api/modules/identity/preferences/application/read-models/preference.read-model";
import { AiDataSharingConsent } from "#api/modules/identity/preferences/domain/ai-data-sharing-consent.entity";
import type { StreakState } from "#api/modules/identity/preferences/domain/streak.vo";
import type { UserConsentRecord } from "#api/modules/identity/preferences/domain/user-consent.constants";
import { UserPreference } from "#api/modules/identity/preferences/domain/user-preference.aggregate";
import type { UserPreferenceRecord } from "#api/modules/identity/preferences/domain/user-preference.constants";
import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
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

  async findStreakByUserId(userId: string): Promise<UserPreference | null> {
    const record = await this.findByUserId(userId);
    return record == null ? null : UserPreference.reconstitute({ userId, ...record });
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
    if (existing === undefined) {
      return this.create(userId, data);
    }
    const record = { ...existing, ...pickBy(data, (value) => value !== undefined) };
    this.records.set(userId, record);
    return { ...record };
  }

  async upsertTimezone(userId: string, timezone: string): Promise<boolean> {
    const existing = this.records.get(userId);
    this.records.set(userId, { ...(existing ?? this.#defaults(userId)), timezone });
    return existing?.timezone !== timezone;
  }

  async refreshTimezoneIfChanged(userId: string, timezone: string): Promise<number> {
    const existing = this.records.get(userId);
    if (existing === undefined || existing.timezone === timezone) {
      return 0;
    }
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
    ) {
      return false;
    }
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
  async findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsent> {
    const record = await this.findByUserId(userId);
    return AiDataSharingConsent.reconstitute({
      userId,
      agreedAt:
        record?.aiDataSharingAgreedAt == null
          ? null
          : Temporal.Instant.fromEpochMilliseconds(record.aiDataSharingAgreedAt.getTime()),
      version: record?.aiDataSharingVersion ?? null,
    });
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
      aiDataSharingAgreedAt: null,
      aiDataSharingVersion: null,
      marketingReconfirmedAt: null,
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
  async upsertAiDataSharingConsent(
    userId: string,
    input: { agreedAt: Date | null; version: string },
  ): Promise<UserConsentRecord> {
    const updated = {
      ...this.#existingOrCreate(userId),
      aiDataSharingAgreedAt: input.agreedAt == null ? null : new Date(input.agreedAt),
      aiDataSharingVersion: input.version,
    };
    this.records.set(userId, updated);
    return { ...updated };
  }
  async findMarketingReconfirmTargets(): Promise<MarketingReconfirmTarget[]> {
    return [];
  }
  async claimMarketingReconfirm(): Promise<MarketingReconfirmTarget[]> {
    return [];
  }
  #existingOrCreate(userId: string): UserConsentRecord {
    return (
      this.records.get(userId) ?? {
        termsAgreedAt: null,
        privacyAgreedAt: null,
        agreedTermsVersion: null,
        marketingAgreedAt: null,
        marketingPushAgreedAt: null,
        aiDataSharingAgreedAt: null,
        aiDataSharingVersion: null,
        marketingReconfirmedAt: null,
      }
    );
  }
}

export class StubUserSettingsCache implements UserSettingsCachePort {
  readonly snapshots = new Map<string, PreferenceSnapshot>();
  async wrapUserPreference(
    userId: string,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot> {
    const snapshot = this.snapshots.get(userId);
    if (snapshot !== undefined) {
      return snapshot;
    }
    const loaded = await factory();
    this.snapshots.set(userId, loaded);
    return loaded;
  }
  async invalidateUserPreference(userId: string): Promise<void> {
    this.snapshots.delete(userId);
  }
}

export class StubReminderTimezoneCache implements ReminderTimezoneCachePort {
  readonly activeTimezones = new Set<string>();
  activeTimezoneInvalidations = 0;

  async invalidateActiveTimezones(): Promise<void> {
    this.activeTimezoneInvalidations += 1;
    this.activeTimezones.clear();
  }
}

export class StubPreferenceEntitlement implements PreferenceEntitlementPort {
  readonly premiumUserIds = new Set<string>();
  async can(userId: string, _feature: PremiumFeature): Promise<boolean> {
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

export class StubTodoTimezoneRebaseEnqueuer implements TodoTimezoneRebaseEnqueuerPort {
  readonly enqueued: string[] = [];
  async enqueueRebase(userId: string): Promise<void> {
    this.enqueued.push(userId);
  }
}

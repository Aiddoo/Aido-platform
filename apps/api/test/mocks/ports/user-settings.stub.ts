import type { PremiumFeature } from "@aido/api/vocabulary";

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
import type { UserSettingsCachePort } from "#api/modules/identity/preferences/application/ports/user-settings-cache.port";
import type { PreferenceSnapshot } from "#api/modules/identity/preferences/application/read-models/preference.read-model";
import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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
  async can(userId: UserId, _feature: PremiumFeature): Promise<boolean> {
    return this.premiumUserIds.has(userId.value);
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
  readonly queries: { userId: string; day: Temporal.PlainDate }[] = [];
  async countForDay(userId: string, day: Temporal.PlainDate): Promise<TodoCompletionStats> {
    this.queries.push({ userId, day });
    return (
      this.days.get(`${userId}/${day.toString()}`) ?? {
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

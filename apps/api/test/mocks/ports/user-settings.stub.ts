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
    userId: UserId,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot> {
    const snapshot = this.snapshots.get(userId.value);
    if (snapshot !== undefined) {
      return snapshot;
    }
    const loaded = await factory();
    this.snapshots.set(userId.value, loaded);
    return loaded;
  }
  async invalidateUserPreference(userId: UserId): Promise<void> {
    this.snapshots.delete(userId.value);
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
  async notifyStreak3Reached(userId: UserId): Promise<void> {
    this.userIds.push(userId.value);
  }
}
export class StubTodoCompletionStatsReader implements TodoCompletionStatsReaderPort {
  readonly days = new Map<string, TodoCompletionStats>();
  readonly queries: { userId: string; day: Temporal.PlainDate }[] = [];
  async countForDay(userId: UserId, day: Temporal.PlainDate): Promise<TodoCompletionStats> {
    this.queries.push({ userId: userId.value, day });
    return (
      this.days.get(`${userId.value}/${day.toString()}`) ?? {
        total: 0,
        completed: 0,
      }
    );
  }
}

export class StubTodoTimezoneRebaseEnqueuer implements TodoTimezoneRebaseEnqueuerPort {
  readonly enqueued: string[] = [];
  async enqueueRebase(userId: UserId): Promise<void> {
    this.enqueued.push(userId.value);
  }
}

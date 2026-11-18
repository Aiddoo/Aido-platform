import type { TransactionHost } from "@nestjs-cls/transactional";

import { DrizzleReEngagementReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-re-engagement.reader";
import { DrizzleScheduledReminderReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduled-reminder.reader";
import { DrizzleSchedulerPreferenceReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler-preference.reader";
import { DrizzleTodoReminderReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-todo-reminder.reader";
import { DrizzleWeatherReminderReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-weather-reminder.reader";
import { DrizzleWeeklyAchievementStatsReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-weekly-achievement-stats.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import type { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

interface SchedulerReadersDependencies {
  readonly transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly clock: ClockPort;
  readonly cache?: CacheStorePort;
}

// 리마인더 조회 포트마다 Drizzle reader를 만든다. 리텐션 실험은 꺼 둔다
export function createSchedulerReaders(dependencies: SchedulerReadersDependencies) {
  const { transactionHost, clock } = dependencies;
  const retention = { onboardingV2: { enabled: false, treatmentPercent: 50 } };
  const cache =
    dependencies.cache ?? new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 });
  return {
    scheduledReminder: new DrizzleScheduledReminderReader(transactionHost, retention, clock),
    reEngagement: new DrizzleReEngagementReader(transactionHost, retention, clock),
    weatherReminder: new DrizzleWeatherReminderReader(transactionHost),
    weeklyAchievementStats: new DrizzleWeeklyAchievementStatsReader(transactionHost, clock),
    todoReminder: new DrizzleTodoReminderReader(transactionHost),
    schedulerPreference: new DrizzleSchedulerPreferenceReader(transactionHost, cache),
  };
}

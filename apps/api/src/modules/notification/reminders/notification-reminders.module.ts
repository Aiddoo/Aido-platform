import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { InsightsWeeklyAchievementsModule } from "#api/modules/insights/weekly-achievements/insights-weekly-achievements.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { DatabaseModule } from "#api/platform/database/database.module";

import { WeatherWeatherReportsModule } from "../../weather/weather-reports/weather-weather-reports.public.js";
import { NotificationNotificationsModule } from "../notifications/notification-notifications.public.js";
import { NotificationPushDispatchesModule } from "../push-dispatches/notification-push-dispatches.public.js";
import { notificationRetentionAssignmentsConfig } from "../retention-assignments/notification-retention-assignments.public.js";
import { TodoReminderSchedulerPort } from "./application/ports/todo-reminder-scheduler.port.js";
import { TimezoneReminderQueueModule } from "./infrastructure/jobs/timezone-reminder-queue.module.js";
import { TimezoneReminderQueueProcessor } from "./infrastructure/jobs/timezone-reminder-queue.processor.js";
import { TimezoneReminderSweepScheduler } from "./infrastructure/jobs/timezone-reminder-sweep.scheduler.js";
import { TodoReminderQueueProcessor } from "./infrastructure/jobs/todo-reminder-queue.processor.js";
import {
  NOTIFICATION_REMINDERS_PERSISTENCE_PROVIDERS,
  NOTIFICATION_REMINDERS_USE_CASE_PROVIDERS,
} from "./notification-reminders.providers.js";

@Module({
  imports: [
    TimezoneReminderQueueModule,
    DatabaseModule,
    NotificationNotificationsModule,
    NotificationPushDispatchesModule,
    WeatherWeatherReportsModule,
    InsightsWeeklyAchievementsModule,
    AccessFeatureGrantsQueriesModule,
    IdentityUserAccessModule,
    PlanningTodoQueriesModule,
    ConfigModule.forFeature(notificationRetentionAssignmentsConfig),
  ],
  providers: [
    ...NOTIFICATION_REMINDERS_PERSISTENCE_PROVIDERS,
    ...NOTIFICATION_REMINDERS_USE_CASE_PROVIDERS,
    TimezoneReminderSweepScheduler,
    TimezoneReminderQueueProcessor,
    TodoReminderQueueProcessor,
  ],
  exports: [TodoReminderSchedulerPort],
})
export class NotificationRemindersModule {}

import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { InsightsWeeklyAchievementsModule } from "#api/modules/insights/weekly-achievements/insights-weekly-achievements.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { DatabaseModule } from "#api/platform/database/database.module";

import { WeatherForecastsModule } from "../../weather/forecasts/weather-forecasts.public.js";
import { NotificationPushModule } from "../push/notification-push.module.js";
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
    NotificationPushModule,
    WeatherForecastsModule,
    InsightsWeeklyAchievementsModule,
    AccessModule,
    IdentityUserAccessModule,
    PlanningTodoQueriesModule,
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

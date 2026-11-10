import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { InsightsWeeklyAchievementsModule } from "#api/modules/insights/insights-weekly-achievements.public";
import { DatabaseModule } from "#api/platform/database/database.module";

import {
  WEATHER_REPORT_READER,
  WeatherForecastModule,
  type WeatherReportReaderPort,
} from "../../weather/weather-forecast.public.js";
import { NotificationPushModule } from "../push/notification-push.module.js";
import { RE_ENGAGEMENT_READER } from "./application/ports/re-engagement-reader.port.js";
import { REMINDER_SCHEDULER } from "./application/ports/reminder-scheduler.port.js";
import {
  REMINDER_WEATHER_REPORT_READER,
  type ReminderWeatherReportReaderPort,
} from "./application/ports/reminder-weather-report.reader.port.js";
import { SCHEDULED_REMINDER_READER } from "./application/ports/scheduled-reminder-reader.port.js";
import { SCHEDULER_DEDUP } from "./application/ports/scheduler-dedup.port.js";
import { SCHEDULER_PREFERENCE_READER } from "./application/ports/scheduler-preference-reader.port.js";
import { TIMEZONE_REMINDER_ENQUEUER } from "./application/ports/timezone-reminder-enqueuer.port.js";
import { TODO_REMINDER_READER } from "./application/ports/todo-reminder-reader.port.js";
import { TODO_SERIES_OWNER_DORMANCY } from "./application/ports/todo-series-owner-dormancy.port.js";
import { WEATHER_REMINDER_READER } from "./application/ports/weather-reminder-reader.port.js";
import { WEEKLY_ACHIEVEMENT_STATS_READER } from "./application/ports/weekly-achievement-stats-reader.port.js";
import { SchedulerDedupAdapter } from "./infrastructure/adapters/scheduler-dedup.adapter.js";
import { TodoSeriesOwnerDormancyAdapter } from "./infrastructure/adapters/todo-series-owner-dormancy.adapter.js";
import { TimezoneReminderQueueAdapter } from "./infrastructure/jobs/timezone-reminder-queue.adapter.js";
import { TimezoneReminderQueueModule } from "./infrastructure/jobs/timezone-reminder-queue.module.js";
import { TimezoneReminderQueueProcessor } from "./infrastructure/jobs/timezone-reminder-queue.processor.js";
import { TodoReminderQueueProcessor } from "./infrastructure/jobs/todo-reminder-queue.processor.js";
import { TodoReminderSchedulerAdapter } from "./infrastructure/jobs/todo-reminder-scheduler.adapter.js";
import { DrizzleSchedulerReader } from "./infrastructure/persistence/drizzle-scheduler.reader.js";
import {
  sendEveningReminderUseCaseProvider,
  sendLunchNudgeUseCaseProvider,
  sendMonthlyReportUseCaseProvider,
  sendMorningReminderUseCaseProvider,
  sendNudgeSuggestUseCaseProvider,
  sendOnboardingUseCaseProvider,
  sendSocialDigestUseCaseProvider,
  sendStreakAtRiskUseCaseProvider,
  sweepTimezoneRemindersUseCaseProvider,
  sendWeatherEveningUseCaseProvider,
  sendWeatherMorningUseCaseProvider,
  sendWeeklyAchievementUseCaseProvider,
  sendWeeklyReportUseCaseProvider,
  sendWinbackUseCaseProvider,
} from "./notification-reminders.providers.js";

@Module({
  imports: [
    TimezoneReminderQueueModule,
    DatabaseModule,
    NotificationPushModule,
    WeatherForecastModule,
    InsightsWeeklyAchievementsModule,
    AccessModule,
    IdentityUserAccessModule,
  ],
  providers: [
    // 오케스트레이터 + 전략 (application)
    sweepTimezoneRemindersUseCaseProvider,
    sendMorningReminderUseCaseProvider,
    sendEveningReminderUseCaseProvider,
    sendOnboardingUseCaseProvider,
    sendWeeklyReportUseCaseProvider,
    sendMonthlyReportUseCaseProvider,
    sendWeeklyAchievementUseCaseProvider,
    sendWinbackUseCaseProvider,
    sendNudgeSuggestUseCaseProvider,
    sendSocialDigestUseCaseProvider,
    sendLunchNudgeUseCaseProvider,
    sendStreakAtRiskUseCaseProvider,
    sendWeatherMorningUseCaseProvider,
    sendWeatherEveningUseCaseProvider,
    // 리더 어댑터 (단일 Drizzle 어댑터 → 분리된 리더 포트들에 바인딩)
    DrizzleSchedulerReader,
    SchedulerDedupAdapter,
    { provide: SCHEDULER_DEDUP, useExisting: SchedulerDedupAdapter },
    { provide: SCHEDULED_REMINDER_READER, useExisting: DrizzleSchedulerReader },
    { provide: RE_ENGAGEMENT_READER, useExisting: DrizzleSchedulerReader },
    { provide: WEATHER_REMINDER_READER, useExisting: DrizzleSchedulerReader },
    {
      provide: WEEKLY_ACHIEVEMENT_STATS_READER,
      useExisting: DrizzleSchedulerReader,
    },
    { provide: TODO_REMINDER_READER, useExisting: DrizzleSchedulerReader },
    { provide: TODO_SERIES_OWNER_DORMANCY, useClass: TodoSeriesOwnerDormancyAdapter },
    // 날씨 알림은 화면과 같은 v2 리포트·칸 캐시를 weather Context의 공개 capability로 읽는다.
    // useExisting은 두 Port의 구조 호환을 검사하지 않으므로 반환 타입으로 컴파일러가 확인하게 한다.
    {
      provide: REMINDER_WEATHER_REPORT_READER,
      inject: [WEATHER_REPORT_READER],
      useFactory: (
        reader: Pick<WeatherReportReaderPort, "readReports">,
      ): ReminderWeatherReportReaderPort => reader,
    },
    {
      provide: SCHEDULER_PREFERENCE_READER,
      useExisting: DrizzleSchedulerReader,
    },
    {
      provide: TIMEZONE_REMINDER_ENQUEUER,
      useExisting: TimezoneReminderQueueAdapter,
    },
    TimezoneReminderQueueProcessor,
    TodoReminderQueueProcessor,
    {
      provide: REMINDER_SCHEDULER,
      useClass: TodoReminderSchedulerAdapter,
    },
  ],
  exports: [REMINDER_SCHEDULER],
})
export class NotificationRemindersModule {}

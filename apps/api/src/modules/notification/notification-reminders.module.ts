import { Module } from "@nestjs/common";

import { InsightsWeeklyAchievementsModule } from "#api/modules/insights/insights-weekly-achievements.public";
import { DatabaseModule } from "#api/platform/database/database.module";

import {
  WEATHER_REPORT_READER,
  WeatherForecastModule,
  type WeatherReportReaderPort,
} from "../weather/weather-forecast.public.js";
import { RE_ENGAGEMENT_READER } from "./application/ports/reminders/re-engagement-reader.port.js";
import { REMINDER_SCHEDULER } from "./application/ports/reminders/reminder-scheduler.port.js";
import {
  REMINDER_WEATHER_REPORT_READER,
  type ReminderWeatherReportReaderPort,
} from "./application/ports/reminders/reminder-weather-report.reader.port.js";
import { SCHEDULED_REMINDER_READER } from "./application/ports/reminders/scheduled-reminder-reader.port.js";
import { SCHEDULER_DEDUP } from "./application/ports/reminders/scheduler-dedup.port.js";
import { SCHEDULER_PREFERENCE_READER } from "./application/ports/reminders/scheduler-preference-reader.port.js";
import { TIMEZONE_REMINDER_ENQUEUER } from "./application/ports/reminders/timezone-reminder-enqueuer.port.js";
import { TODO_REMINDER_READER } from "./application/ports/reminders/todo-reminder-reader.port.js";
import { WEATHER_REMINDER_READER } from "./application/ports/reminders/weather-reminder-reader.port.js";
import { WEEKLY_ACHIEVEMENT_STATS_READER } from "./application/ports/reminders/weekly-achievement-stats-reader.port.js";
import { SchedulerDedupAdapter } from "./infrastructure/adapters/reminders/scheduler-dedup.adapter.js";
import { TimezoneReminderQueueModule } from "./infrastructure/jobs/reminders/timezone-reminder-queue.module.js";
import { TimezoneReminderProcessor } from "./infrastructure/jobs/reminders/timezone-reminder-queue.processor.js";
import { TimezoneReminderQueueService } from "./infrastructure/jobs/reminders/timezone-reminder-queue.service.js";
import { TodoReminderQueueProcessor } from "./infrastructure/jobs/reminders/todo-reminder-queue.processor.js";
import { TodoReminderSchedulerAdapter } from "./infrastructure/jobs/reminders/todo-reminder-scheduler.adapter.js";
import { DrizzleSchedulerReader } from "./infrastructure/persistence/reminders/drizzle-scheduler.reader.js";
import { NotificationDeliveryModule } from "./notification-delivery.module.js";
import {
  eveningReminderStrategyProvider,
  lunchNudgeStrategyProvider,
  monthlyReportStrategyProvider,
  morningReminderStrategyProvider,
  nudgeSuggestStrategyProvider,
  onboardingStrategyProvider,
  socialDigestStrategyProvider,
  streakAtRiskStrategyProvider,
  timezoneAwareReminderOrchestratorProvider,
  weatherEveningStrategyProvider,
  weatherMorningStrategyProvider,
  weeklyAchievementStrategyProvider,
  weeklyReportStrategyProvider,
  winbackStrategyProvider,
} from "./notification-reminders-application.providers.js";

@Module({
  imports: [
    TimezoneReminderQueueModule,
    DatabaseModule,
    NotificationDeliveryModule,
    WeatherForecastModule,
    InsightsWeeklyAchievementsModule,
  ],
  providers: [
    // 오케스트레이터 + 전략 (application)
    timezoneAwareReminderOrchestratorProvider,
    morningReminderStrategyProvider,
    eveningReminderStrategyProvider,
    onboardingStrategyProvider,
    weeklyReportStrategyProvider,
    monthlyReportStrategyProvider,
    weeklyAchievementStrategyProvider,
    winbackStrategyProvider,
    nudgeSuggestStrategyProvider,
    socialDigestStrategyProvider,
    lunchNudgeStrategyProvider,
    streakAtRiskStrategyProvider,
    weatherMorningStrategyProvider,
    weatherEveningStrategyProvider,
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
      useExisting: TimezoneReminderQueueService,
    },
    TimezoneReminderProcessor,
    TodoReminderQueueProcessor,
    {
      provide: REMINDER_SCHEDULER,
      useClass: TodoReminderSchedulerAdapter,
    },
  ],
  exports: [REMINDER_SCHEDULER],
})
export class NotificationRemindersModule {}

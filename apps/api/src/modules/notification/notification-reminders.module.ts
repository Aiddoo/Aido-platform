import { Module } from "@nestjs/common";

import { InsightsWeeklyAchievementsModule } from "#api/modules/insights/insights-weekly-achievements.public";
import { DatabaseModule } from "#api/platform/database/database.module";

import { WeatherModule } from "../weather/weather-forecast.module.js";
import { RE_ENGAGEMENT_READER } from "./application/ports/reminders/re-engagement-reader.port.js";
import { REMINDER_SCHEDULER } from "./application/ports/reminders/reminder-scheduler.port.js";
import { SCHEDULED_REMINDER_READER } from "./application/ports/reminders/scheduled-reminder-reader.port.js";
import { SCHEDULER_DEDUP } from "./application/ports/reminders/scheduler-dedup.port.js";
import { SCHEDULER_PREFERENCE_READER } from "./application/ports/reminders/scheduler-preference-reader.port.js";
import { TIMEZONE_REMINDER_ENQUEUER } from "./application/ports/reminders/timezone-reminder-enqueuer.port.js";
import { TODO_REMINDER_READER } from "./application/ports/reminders/todo-reminder-reader.port.js";
import { WEATHER_REMINDER_READER } from "./application/ports/reminders/weather-reminder-reader.port.js";
import { WEEKLY_ACHIEVEMENT_STATS_READER } from "./application/ports/reminders/weekly-achievement-stats-reader.port.js";
import { SchedulerDedupAdapter } from "./infrastructure/adapters/reminders/scheduler-dedup.adapter.js";
import { BullMQReminderSchedulerAdapter } from "./infrastructure/jobs/reminders/bullmq-reminder-scheduler.adapter.js";
import {
  TimezoneReminderQueueModule,
  TimezoneReminderQueueService,
} from "./infrastructure/jobs/reminders/index.js";
import { TimezoneReminderProcessor } from "./infrastructure/jobs/reminders/timezone-reminder-queue.processor.js";
import { PrismaSchedulerReader } from "./infrastructure/persistence/reminders/prisma-scheduler.reader.js";
import { TodoReminderProcessor } from "./infrastructure/processors/reminders/todo-reminder.processor.js";
import { NotificationModule } from "./notification-delivery.module.js";
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

/**
 * SchedulerModule (클린아키텍처 4계층 + 포트/어댑터)
 *
 * 일정 기반 알림을 처리하는 모듈.
 * - 타임존 인식 리마인더: 매분 Sweep (BullMQ Job Scheduler — 아침/저녁 리마인더 통합)
 * - BullMQ 지연 잡: 투두 생성/수정 시 정확한 시점에 리마인더 예약 (Redis 영속성)
 *
 * - domain: 스케줄 정책(순수 함수) — 알림 시간·리마인더 단계·winback·onboarding
 * - application: 오케스트레이터·13 전략·리더/enqueuer 포트
 * - infrastructure: Prisma 리더·BullMQ 큐/스케줄러/프로세서
 */
@Module({
  imports: [
    TimezoneReminderQueueModule,
    DatabaseModule,
    NotificationModule,
    WeatherModule,
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
    // 리더 어댑터 (단일 Prisma 어댑터 → 분리된 리더 포트들에 바인딩)
    PrismaSchedulerReader,
    SchedulerDedupAdapter,
    { provide: SCHEDULER_DEDUP, useExisting: SchedulerDedupAdapter },
    { provide: SCHEDULED_REMINDER_READER, useExisting: PrismaSchedulerReader },
    { provide: RE_ENGAGEMENT_READER, useExisting: PrismaSchedulerReader },
    { provide: WEATHER_REMINDER_READER, useExisting: PrismaSchedulerReader },
    {
      provide: WEEKLY_ACHIEVEMENT_STATS_READER,
      useExisting: PrismaSchedulerReader,
    },
    { provide: TODO_REMINDER_READER, useExisting: PrismaSchedulerReader },
    {
      provide: SCHEDULER_PREFERENCE_READER,
      useExisting: PrismaSchedulerReader,
    },
    // enqueue 포트 (BullMQ 큐 서비스 재사용)
    {
      provide: TIMEZONE_REMINDER_ENQUEUER,
      useExisting: TimezoneReminderQueueService,
    },
    // BullMQ 프로세서 (진입 어댑터)
    TimezoneReminderProcessor,
    TodoReminderProcessor,
    // 리마인더 스케줄러 포트 (todo 소비)
    {
      provide: REMINDER_SCHEDULER,
      useClass: BullMQReminderSchedulerAdapter,
    },
  ],
  exports: [REMINDER_SCHEDULER],
})
export class SchedulerModule {}

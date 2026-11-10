import type { Provider } from "@nestjs/common";

import { WeeklyAchievementWriterPort as InsightsWeeklyAchievementWriterPort } from "#api/modules/insights/weekly-achievements/insights-weekly-achievements.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

import { WeatherReportReaderPort } from "../../weather/forecasts/weather-forecasts.public.js";
import { NotificationHistoryReader } from "../inbox/application/notification-history.reader.js";
import { PublishNotificationUseCase } from "../push/application/use-cases/publish-notification.use-case.js";
import { ReEngagementReaderPort } from "./application/ports/re-engagement-reader.port.js";
import { ReminderWeatherReportReaderPort } from "./application/ports/reminder-weather-report.reader.port.js";
import { ScheduledReminderReaderPort } from "./application/ports/scheduled-reminder-reader.port.js";
import { SchedulerDedupPort } from "./application/ports/scheduler-dedup.port.js";
import { SchedulerPreferenceReaderPort } from "./application/ports/scheduler-preference-reader.port.js";
import { TimezoneReminderEnqueuerPort } from "./application/ports/timezone-reminder-enqueuer.port.js";
import { TodoReminderReaderPort } from "./application/ports/todo-reminder-reader.port.js";
import { TodoReminderSchedulerPort } from "./application/ports/todo-reminder-scheduler.port.js";
import { TodoSeriesOwnerDormancyPort } from "./application/ports/todo-series-owner-dormancy.port.js";
import { WeatherBriefingTodoReaderPort } from "./application/ports/weather-briefing-todo.reader.port.js";
import { WeatherReminderReaderPort } from "./application/ports/weather-reminder-reader.port.js";
import { WeeklyAchievementStatsReaderPort } from "./application/ports/weekly-achievement-stats-reader.port.js";
import { WeeklyAchievementWriterPort } from "./application/ports/weekly-achievement-writer.port.js";
import { SendEveningReminderUseCase } from "./application/use-cases/send-evening-reminder.use-case.js";
import { SendLunchNudgeUseCase } from "./application/use-cases/send-lunch-nudge.use-case.js";
import { SendMonthlyReportUseCase } from "./application/use-cases/send-monthly-report.use-case.js";
import { SendMorningReminderUseCase } from "./application/use-cases/send-morning-reminder.use-case.js";
import { SendNudgeSuggestUseCase } from "./application/use-cases/send-nudge-suggest.use-case.js";
import { SendOnboardingUseCase } from "./application/use-cases/send-onboarding.use-case.js";
import { SendSocialDigestUseCase } from "./application/use-cases/send-social-digest.use-case.js";
import { SendStreakAtRiskUseCase } from "./application/use-cases/send-streak-at-risk.use-case.js";
import { SendWeatherEveningUseCase } from "./application/use-cases/send-weather-evening.use-case.js";
import { SendWeatherMorningUseCase } from "./application/use-cases/send-weather-morning.use-case.js";
import { SendWeeklyAchievementUseCase } from "./application/use-cases/send-weekly-achievement.use-case.js";
import { SendWeeklyReportUseCase } from "./application/use-cases/send-weekly-report.use-case.js";
import { SendWinbackUseCase } from "./application/use-cases/send-winback.use-case.js";
import { SweepTimezoneRemindersUseCase } from "./application/use-cases/sweep-timezone-reminders.use-case.js";
import { PlanningWeatherBriefingTodoAdapter } from "./infrastructure/adapters/planning-weather-briefing-todo.adapter.js";
import { SchedulerDedupAdapter } from "./infrastructure/adapters/scheduler-dedup.adapter.js";
import { TodoSeriesOwnerDormancyAdapter } from "./infrastructure/adapters/todo-series-owner-dormancy.adapter.js";
import { TodoReminderSchedulerAdapter } from "./infrastructure/jobs/todo-reminder-scheduler.adapter.js";
import { DrizzleSchedulerReader } from "./infrastructure/persistence/drizzle-scheduler.reader.js";

// 읽기 포트는 계약별로 나뉘고 DB 접근은 Drizzle 어댑터 하나에 모인다
export const NOTIFICATION_REMINDERS_PERSISTENCE_PROVIDERS = [
  { provide: WeatherBriefingTodoReaderPort, useClass: PlanningWeatherBriefingTodoAdapter },
  DrizzleSchedulerReader,
  { provide: ScheduledReminderReaderPort, useExisting: DrizzleSchedulerReader },
  { provide: ReEngagementReaderPort, useExisting: DrizzleSchedulerReader },
  { provide: WeatherReminderReaderPort, useExisting: DrizzleSchedulerReader },
  { provide: WeeklyAchievementStatsReaderPort, useExisting: DrizzleSchedulerReader },
  { provide: TodoReminderReaderPort, useExisting: DrizzleSchedulerReader },
  { provide: SchedulerPreferenceReaderPort, useExisting: DrizzleSchedulerReader },
  { provide: SchedulerDedupPort, useClass: SchedulerDedupAdapter },
  { provide: TodoSeriesOwnerDormancyPort, useClass: TodoSeriesOwnerDormancyAdapter },
  { provide: TodoReminderSchedulerPort, useClass: TodoReminderSchedulerAdapter },
  // 날씨 알림은 화면과 같은 v2 리포트·칸 캐시를 weather Context의 공개 capability로 읽는다
  {
    provide: ReminderWeatherReportReaderPort,
    inject: [WeatherReportReaderPort],
    useFactory: (
      reader: Pick<WeatherReportReaderPort, "readReports">,
    ): ReminderWeatherReportReaderPort => reader,
  },
  {
    provide: WeeklyAchievementWriterPort,
    inject: [InsightsWeeklyAchievementWriterPort],
    useFactory: (
      writer: Pick<InsightsWeeklyAchievementWriterPort, "execute">,
    ): WeeklyAchievementWriterPort => ({
      execute: ({ records }) =>
        writer.execute({
          records: records.map((record) => ({ ...record, userId: record.userId.value })),
        }),
    }),
  },
] satisfies Provider[];

export const NOTIFICATION_REMINDERS_USE_CASE_PROVIDERS = [
  provideUseCase(SendMorningReminderUseCase, {
    reader: ScheduledReminderReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendMorningReminderUseCase),
  }),
  provideUseCase(SendEveningReminderUseCase, {
    reader: ScheduledReminderReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendEveningReminderUseCase),
  }),
  provideUseCase(SendLunchNudgeUseCase, {
    reader: ScheduledReminderReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendLunchNudgeUseCase),
  }),
  provideUseCase(SendWeeklyReportUseCase, {
    reader: ScheduledReminderReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendWeeklyReportUseCase),
  }),
  provideUseCase(SendMonthlyReportUseCase, {
    reader: ScheduledReminderReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendMonthlyReportUseCase),
  }),
  provideUseCase(SendWeeklyAchievementUseCase, {
    reader: WeeklyAchievementStatsReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    weeklyAchievementWriter: WeeklyAchievementWriterPort,
    logger: loggerFor(SendWeeklyAchievementUseCase),
  }),
  provideUseCase(SendWinbackUseCase, {
    reader: ReEngagementReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    schedulerDedup: SchedulerDedupPort,
    logger: loggerFor(SendWinbackUseCase),
  }),
  provideUseCase(SendNudgeSuggestUseCase, {
    reader: ReEngagementReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    schedulerDedup: SchedulerDedupPort,
    logger: loggerFor(SendNudgeSuggestUseCase),
  }),
  provideUseCase(SendOnboardingUseCase, {
    reader: ReEngagementReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendOnboardingUseCase),
  }),
  provideUseCase(SendSocialDigestUseCase, {
    reader: ReEngagementReaderPort,
    preferenceReader: SchedulerPreferenceReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendSocialDigestUseCase),
  }),
  provideUseCase(SendStreakAtRiskUseCase, {
    reader: ReEngagementReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    logger: loggerFor(SendStreakAtRiskUseCase),
  }),
  provideUseCase(SendWeatherMorningUseCase, {
    reader: WeatherReminderReaderPort,
    todoReader: WeatherBriefingTodoReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    weatherReportReader: ReminderWeatherReportReaderPort,
    clock: ClockPort,
    logger: loggerFor(SendWeatherMorningUseCase),
  }),
  provideUseCase(SendWeatherEveningUseCase, {
    reader: WeatherReminderReaderPort,
    notificationPublisher: PublishNotificationUseCase,
    notificationHistoryReader: NotificationHistoryReader,
    weatherReportReader: ReminderWeatherReportReaderPort,
    clock: ClockPort,
    logger: loggerFor(SendWeatherEveningUseCase),
  }),
  provideSweepTimezoneRemindersUseCase(),
] satisfies Provider[];

export function provideSweepTimezoneRemindersUseCase() {
  return provideUseCase(SweepTimezoneRemindersUseCase, {
    preferenceReader: SchedulerPreferenceReaderPort,
    enqueuer: TimezoneReminderEnqueuerPort,
    sweepCursor: SweepCursorPort,
    clock: ClockPort,
    morningReminder: SendMorningReminderUseCase,
    eveningReminder: SendEveningReminderUseCase,
    weeklyReport: SendWeeklyReportUseCase,
    monthlyReport: SendMonthlyReportUseCase,
    weeklyAchievement: SendWeeklyAchievementUseCase,
    winback: SendWinbackUseCase,
    nudgeSuggest: SendNudgeSuggestUseCase,
    socialDigest: SendSocialDigestUseCase,
    lunchNudge: SendLunchNudgeUseCase,
    streakAtRisk: SendStreakAtRiskUseCase,
    onboarding: SendOnboardingUseCase,
    weatherMorning: SendWeatherMorningUseCase,
    weatherEvening: SendWeatherEveningUseCase,
    logger: loggerFor(SweepTimezoneRemindersUseCase),
    alert: OperationalAlertPort,
  });
}

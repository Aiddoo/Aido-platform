import { Logger, type FactoryProvider } from "@nestjs/common";

import { WEEKLY_ACHIEVEMENT_WRITER } from "#api/modules/insights/insights-weekly-achievements.public";

import { NotificationHistoryReader } from "../inbox/application/notification-history.reader.js";
import { PublishNotificationUseCase } from "../push/application/use-cases/publish-notification.use-case.js";
import { RE_ENGAGEMENT_READER } from "./application/ports/re-engagement-reader.port.js";
import { REMINDER_WEATHER_REPORT_READER } from "./application/ports/reminder-weather-report.reader.port.js";
import { SCHEDULED_REMINDER_READER } from "./application/ports/scheduled-reminder-reader.port.js";
import { SCHEDULER_DEDUP } from "./application/ports/scheduler-dedup.port.js";
import { SCHEDULER_PREFERENCE_READER } from "./application/ports/scheduler-preference-reader.port.js";
import { TIMEZONE_REMINDER_ENQUEUER } from "./application/ports/timezone-reminder-enqueuer.port.js";
import { WEATHER_REMINDER_READER } from "./application/ports/weather-reminder-reader.port.js";
import { WEEKLY_ACHIEVEMENT_STATS_READER } from "./application/ports/weekly-achievement-stats-reader.port.js";
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

export const sweepTimezoneRemindersUseCaseProvider: FactoryProvider<SweepTimezoneRemindersUseCase> =
  {
    provide: SweepTimezoneRemindersUseCase,
    inject: [
      SCHEDULER_PREFERENCE_READER,
      TIMEZONE_REMINDER_ENQUEUER,
      SendMorningReminderUseCase,
      SendEveningReminderUseCase,
      SendWeeklyReportUseCase,
      SendMonthlyReportUseCase,
      SendWeeklyAchievementUseCase,
      SendWinbackUseCase,
      SendNudgeSuggestUseCase,
      SendSocialDigestUseCase,
      SendLunchNudgeUseCase,
      SendStreakAtRiskUseCase,
      SendOnboardingUseCase,
      SendWeatherMorningUseCase,
      SendWeatherEveningUseCase,
    ],
    useFactory: (
      preferenceReader: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["preferenceReader"],
      enqueuer: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["enqueuer"],
      morningReminder: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["morningReminder"],
      eveningReminder: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["eveningReminder"],
      weeklyReport: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["weeklyReport"],
      monthlyReport: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["monthlyReport"],
      weeklyAchievement: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["weeklyAchievement"],
      winback: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["winback"],
      nudgeSuggest: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["nudgeSuggest"],
      socialDigest: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["socialDigest"],
      lunchNudge: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["lunchNudge"],
      streakAtRisk: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["streakAtRisk"],
      onboarding: ConstructorParameters<typeof SweepTimezoneRemindersUseCase>[0]["onboarding"],
      weatherMorning: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["weatherMorning"],
      weatherEvening: ConstructorParameters<
        typeof SweepTimezoneRemindersUseCase
      >[0]["weatherEvening"],
    ) =>
      new SweepTimezoneRemindersUseCase({
        preferenceReader,
        enqueuer,
        morningReminder,
        eveningReminder,
        weeklyReport,
        monthlyReport,
        weeklyAchievement,
        winback,
        nudgeSuggest,
        socialDigest,
        lunchNudge,
        streakAtRisk,
        onboarding,
        weatherMorning,
        weatherEvening,
        logger: new Logger(SweepTimezoneRemindersUseCase.name),
      }),
  };

export const sendEveningReminderUseCaseProvider: FactoryProvider<SendEveningReminderUseCase> = {
  provide: SendEveningReminderUseCase,
  inject: [SCHEDULED_REMINDER_READER, PublishNotificationUseCase, NotificationHistoryReader],
  useFactory: (
    reader: ConstructorParameters<typeof SendEveningReminderUseCase>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof SendEveningReminderUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendEveningReminderUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendEveningReminderUseCase({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendEveningReminderUseCase.name),
    }),
};

export const sendLunchNudgeUseCaseProvider: FactoryProvider<SendLunchNudgeUseCase> = {
  provide: SendLunchNudgeUseCase,
  inject: [
    SCHEDULED_REMINDER_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendLunchNudgeUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendLunchNudgeUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendLunchNudgeUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendLunchNudgeUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendLunchNudgeUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendLunchNudgeUseCase.name),
    }),
};

export const sendMonthlyReportUseCaseProvider: FactoryProvider<SendMonthlyReportUseCase> = {
  provide: SendMonthlyReportUseCase,
  inject: [
    SCHEDULED_REMINDER_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendMonthlyReportUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendMonthlyReportUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendMonthlyReportUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendMonthlyReportUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendMonthlyReportUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendMonthlyReportUseCase.name),
    }),
};

export const sendMorningReminderUseCaseProvider: FactoryProvider<SendMorningReminderUseCase> = {
  provide: SendMorningReminderUseCase,
  inject: [SCHEDULED_REMINDER_READER, PublishNotificationUseCase, NotificationHistoryReader],
  useFactory: (
    reader: ConstructorParameters<typeof SendMorningReminderUseCase>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof SendMorningReminderUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendMorningReminderUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendMorningReminderUseCase({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendMorningReminderUseCase.name),
    }),
};

export const sendNudgeSuggestUseCaseProvider: FactoryProvider<SendNudgeSuggestUseCase> = {
  provide: SendNudgeSuggestUseCase,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
    SCHEDULER_DEDUP,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendNudgeSuggestUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendNudgeSuggestUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendNudgeSuggestUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendNudgeSuggestUseCase
    >[0]["notificationHistoryReader"],
    schedulerDedup: ConstructorParameters<typeof SendNudgeSuggestUseCase>[0]["schedulerDedup"],
  ) =>
    new SendNudgeSuggestUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      schedulerDedup,
      logger: new Logger(SendNudgeSuggestUseCase.name),
    }),
};

export const sendOnboardingUseCaseProvider: FactoryProvider<SendOnboardingUseCase> = {
  provide: SendOnboardingUseCase,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendOnboardingUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendOnboardingUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendOnboardingUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendOnboardingUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendOnboardingUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendOnboardingUseCase.name),
    }),
};

export const sendSocialDigestUseCaseProvider: FactoryProvider<SendSocialDigestUseCase> = {
  provide: SendSocialDigestUseCase,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendSocialDigestUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendSocialDigestUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendSocialDigestUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendSocialDigestUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendSocialDigestUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendSocialDigestUseCase.name),
    }),
};

export const sendStreakAtRiskUseCaseProvider: FactoryProvider<SendStreakAtRiskUseCase> = {
  provide: SendStreakAtRiskUseCase,
  inject: [RE_ENGAGEMENT_READER, PublishNotificationUseCase, NotificationHistoryReader],
  useFactory: (
    reader: ConstructorParameters<typeof SendStreakAtRiskUseCase>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof SendStreakAtRiskUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendStreakAtRiskUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendStreakAtRiskUseCase({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendStreakAtRiskUseCase.name),
    }),
};

export const sendWeatherEveningUseCaseProvider: FactoryProvider<SendWeatherEveningUseCase> = {
  provide: SendWeatherEveningUseCase,
  inject: [
    WEATHER_REMINDER_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
    REMINDER_WEATHER_REPORT_READER,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendWeatherEveningUseCase>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof SendWeatherEveningUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendWeatherEveningUseCase
    >[0]["notificationHistoryReader"],
    weatherReportReader: ConstructorParameters<
      typeof SendWeatherEveningUseCase
    >[0]["weatherReportReader"],
  ) =>
    new SendWeatherEveningUseCase({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      weatherReportReader,
      logger: new Logger(SendWeatherEveningUseCase.name),
    }),
};

export const sendWeatherMorningUseCaseProvider: FactoryProvider<SendWeatherMorningUseCase> = {
  provide: SendWeatherMorningUseCase,
  inject: [
    WEATHER_REMINDER_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
    REMINDER_WEATHER_REPORT_READER,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendWeatherMorningUseCase>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof SendWeatherMorningUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendWeatherMorningUseCase
    >[0]["notificationHistoryReader"],
    weatherReportReader: ConstructorParameters<
      typeof SendWeatherMorningUseCase
    >[0]["weatherReportReader"],
  ) =>
    new SendWeatherMorningUseCase({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      weatherReportReader,
      logger: new Logger(SendWeatherMorningUseCase.name),
    }),
};

export const sendWeeklyAchievementUseCaseProvider: FactoryProvider<SendWeeklyAchievementUseCase> = {
  provide: SendWeeklyAchievementUseCase,
  inject: [
    WEEKLY_ACHIEVEMENT_STATS_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
    WEEKLY_ACHIEVEMENT_WRITER,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendWeeklyAchievementUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<
      typeof SendWeeklyAchievementUseCase
    >[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendWeeklyAchievementUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendWeeklyAchievementUseCase
    >[0]["notificationHistoryReader"],
    weeklyAchievementWriter: ConstructorParameters<
      typeof SendWeeklyAchievementUseCase
    >[0]["weeklyAchievementWriter"],
  ) =>
    new SendWeeklyAchievementUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      weeklyAchievementWriter,
      logger: new Logger(SendWeeklyAchievementUseCase.name),
    }),
};

export const sendWeeklyReportUseCaseProvider: FactoryProvider<SendWeeklyReportUseCase> = {
  provide: SendWeeklyReportUseCase,
  inject: [
    SCHEDULED_REMINDER_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendWeeklyReportUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendWeeklyReportUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendWeeklyReportUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendWeeklyReportUseCase
    >[0]["notificationHistoryReader"],
  ) =>
    new SendWeeklyReportUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SendWeeklyReportUseCase.name),
    }),
};

export const sendWinbackUseCaseProvider: FactoryProvider<SendWinbackUseCase> = {
  provide: SendWinbackUseCase,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    PublishNotificationUseCase,
    NotificationHistoryReader,
    SCHEDULER_DEDUP,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SendWinbackUseCase>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SendWinbackUseCase>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SendWinbackUseCase
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SendWinbackUseCase
    >[0]["notificationHistoryReader"],
    schedulerDedup: ConstructorParameters<typeof SendWinbackUseCase>[0]["schedulerDedup"],
  ) =>
    new SendWinbackUseCase({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      schedulerDedup,
      logger: new Logger(SendWinbackUseCase.name),
    }),
};

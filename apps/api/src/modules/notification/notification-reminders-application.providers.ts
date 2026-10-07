import { Logger, type FactoryProvider } from "@nestjs/common";

import { WEEKLY_ACHIEVEMENT_WRITER } from "#api/modules/insights/insights-weekly-achievements.public";
import {
  NotificationPublisher,
  NotificationHistoryReader,
} from "#api/modules/notification/notification-delivery.public";
import { WEATHER_FORECAST_READER } from "#api/modules/weather/weather-forecast.public";

import { RE_ENGAGEMENT_READER } from "./application/ports/reminders/re-engagement-reader.port.js";
import { SCHEDULED_REMINDER_READER } from "./application/ports/reminders/scheduled-reminder-reader.port.js";
import { SCHEDULER_DEDUP } from "./application/ports/reminders/scheduler-dedup.port.js";
import { SCHEDULER_PREFERENCE_READER } from "./application/ports/reminders/scheduler-preference-reader.port.js";
import { TIMEZONE_REMINDER_ENQUEUER } from "./application/ports/reminders/timezone-reminder-enqueuer.port.js";
import { WEATHER_REMINDER_READER } from "./application/ports/reminders/weather-reminder-reader.port.js";
import { WEEKLY_ACHIEVEMENT_STATS_READER } from "./application/ports/reminders/weekly-achievement-stats-reader.port.js";
import { TimezoneAwareReminderOrchestrator } from "./application/services/reminders/timezone-aware-reminder.orchestrator.js";
import { EveningReminderStrategy } from "./application/strategies/reminders/evening-reminder.strategy.js";
import { LunchNudgeStrategy } from "./application/strategies/reminders/lunch-nudge.strategy.js";
import { MonthlyReportStrategy } from "./application/strategies/reminders/monthly-report.strategy.js";
import { MorningReminderStrategy } from "./application/strategies/reminders/morning-reminder.strategy.js";
import { NudgeSuggestStrategy } from "./application/strategies/reminders/nudge-suggest.strategy.js";
import { OnboardingStrategy } from "./application/strategies/reminders/onboarding.strategy.js";
import { SocialDigestStrategy } from "./application/strategies/reminders/social-digest.strategy.js";
import { StreakAtRiskStrategy } from "./application/strategies/reminders/streak-at-risk.strategy.js";
import { WeatherEveningStrategy } from "./application/strategies/reminders/weather-evening.strategy.js";
import { WeatherMorningStrategy } from "./application/strategies/reminders/weather-morning.strategy.js";
import { WeeklyAchievementStrategy } from "./application/strategies/reminders/weekly-achievement.strategy.js";
import { WeeklyReportStrategy } from "./application/strategies/reminders/weekly-report.strategy.js";
import { WinbackStrategy } from "./application/strategies/reminders/winback.strategy.js";

export const timezoneAwareReminderOrchestratorProvider: FactoryProvider<TimezoneAwareReminderOrchestrator> =
  {
    provide: TimezoneAwareReminderOrchestrator,
    inject: [
      SCHEDULER_PREFERENCE_READER,
      TIMEZONE_REMINDER_ENQUEUER,
      MorningReminderStrategy,
      EveningReminderStrategy,
      WeeklyReportStrategy,
      MonthlyReportStrategy,
      WeeklyAchievementStrategy,
      WinbackStrategy,
      NudgeSuggestStrategy,
      SocialDigestStrategy,
      LunchNudgeStrategy,
      StreakAtRiskStrategy,
      OnboardingStrategy,
      WeatherMorningStrategy,
      WeatherEveningStrategy,
    ],
    useFactory: (
      preferenceReader: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["preferenceReader"],
      enqueuer: ConstructorParameters<typeof TimezoneAwareReminderOrchestrator>[0]["enqueuer"],
      morningReminder: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["morningReminder"],
      eveningReminder: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["eveningReminder"],
      weeklyReport: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["weeklyReport"],
      monthlyReport: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["monthlyReport"],
      weeklyAchievement: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["weeklyAchievement"],
      winback: ConstructorParameters<typeof TimezoneAwareReminderOrchestrator>[0]["winback"],
      nudgeSuggest: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["nudgeSuggest"],
      socialDigest: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["socialDigest"],
      lunchNudge: ConstructorParameters<typeof TimezoneAwareReminderOrchestrator>[0]["lunchNudge"],
      streakAtRisk: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["streakAtRisk"],
      onboarding: ConstructorParameters<typeof TimezoneAwareReminderOrchestrator>[0]["onboarding"],
      weatherMorning: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["weatherMorning"],
      weatherEvening: ConstructorParameters<
        typeof TimezoneAwareReminderOrchestrator
      >[0]["weatherEvening"],
    ) =>
      new TimezoneAwareReminderOrchestrator({
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
        logger: new Logger(TimezoneAwareReminderOrchestrator.name),
      }),
  };

export const eveningReminderStrategyProvider: FactoryProvider<EveningReminderStrategy> = {
  provide: EveningReminderStrategy,
  inject: [SCHEDULED_REMINDER_READER, NotificationPublisher, NotificationHistoryReader],
  useFactory: (
    reader: ConstructorParameters<typeof EveningReminderStrategy>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof EveningReminderStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof EveningReminderStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new EveningReminderStrategy({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(EveningReminderStrategy.name),
    }),
};

export const lunchNudgeStrategyProvider: FactoryProvider<LunchNudgeStrategy> = {
  provide: LunchNudgeStrategy,
  inject: [
    SCHEDULED_REMINDER_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof LunchNudgeStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof LunchNudgeStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof LunchNudgeStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof LunchNudgeStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new LunchNudgeStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(LunchNudgeStrategy.name),
    }),
};

export const monthlyReportStrategyProvider: FactoryProvider<MonthlyReportStrategy> = {
  provide: MonthlyReportStrategy,
  inject: [
    SCHEDULED_REMINDER_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof MonthlyReportStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof MonthlyReportStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof MonthlyReportStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof MonthlyReportStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new MonthlyReportStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(MonthlyReportStrategy.name),
    }),
};

export const morningReminderStrategyProvider: FactoryProvider<MorningReminderStrategy> = {
  provide: MorningReminderStrategy,
  inject: [SCHEDULED_REMINDER_READER, NotificationPublisher, NotificationHistoryReader],
  useFactory: (
    reader: ConstructorParameters<typeof MorningReminderStrategy>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof MorningReminderStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof MorningReminderStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new MorningReminderStrategy({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(MorningReminderStrategy.name),
    }),
};

export const nudgeSuggestStrategyProvider: FactoryProvider<NudgeSuggestStrategy> = {
  provide: NudgeSuggestStrategy,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
    SCHEDULER_DEDUP,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof NudgeSuggestStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof NudgeSuggestStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof NudgeSuggestStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof NudgeSuggestStrategy
    >[0]["notificationHistoryReader"],
    schedulerDedup: ConstructorParameters<typeof NudgeSuggestStrategy>[0]["schedulerDedup"],
  ) =>
    new NudgeSuggestStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      schedulerDedup,
      logger: new Logger(NudgeSuggestStrategy.name),
    }),
};

export const onboardingStrategyProvider: FactoryProvider<OnboardingStrategy> = {
  provide: OnboardingStrategy,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof OnboardingStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof OnboardingStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof OnboardingStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof OnboardingStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new OnboardingStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(OnboardingStrategy.name),
    }),
};

export const socialDigestStrategyProvider: FactoryProvider<SocialDigestStrategy> = {
  provide: SocialDigestStrategy,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof SocialDigestStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof SocialDigestStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof SocialDigestStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof SocialDigestStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new SocialDigestStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(SocialDigestStrategy.name),
    }),
};

export const streakAtRiskStrategyProvider: FactoryProvider<StreakAtRiskStrategy> = {
  provide: StreakAtRiskStrategy,
  inject: [RE_ENGAGEMENT_READER, NotificationPublisher, NotificationHistoryReader],
  useFactory: (
    reader: ConstructorParameters<typeof StreakAtRiskStrategy>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof StreakAtRiskStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof StreakAtRiskStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new StreakAtRiskStrategy({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(StreakAtRiskStrategy.name),
    }),
};

export const weatherEveningStrategyProvider: FactoryProvider<WeatherEveningStrategy> = {
  provide: WeatherEveningStrategy,
  inject: [
    WEATHER_REMINDER_READER,
    NotificationPublisher,
    NotificationHistoryReader,
    WEATHER_FORECAST_READER,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WeatherEveningStrategy>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof WeatherEveningStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof WeatherEveningStrategy
    >[0]["notificationHistoryReader"],
    weatherForecastReader: ConstructorParameters<
      typeof WeatherEveningStrategy
    >[0]["weatherForecastReader"],
  ) =>
    new WeatherEveningStrategy({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      weatherForecastReader,
      logger: new Logger(WeatherEveningStrategy.name),
    }),
};

export const weatherMorningStrategyProvider: FactoryProvider<WeatherMorningStrategy> = {
  provide: WeatherMorningStrategy,
  inject: [
    WEATHER_REMINDER_READER,
    NotificationPublisher,
    NotificationHistoryReader,
    WEATHER_FORECAST_READER,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WeatherMorningStrategy>[0]["reader"],
    notificationPublisher: ConstructorParameters<
      typeof WeatherMorningStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof WeatherMorningStrategy
    >[0]["notificationHistoryReader"],
    weatherForecastReader: ConstructorParameters<
      typeof WeatherMorningStrategy
    >[0]["weatherForecastReader"],
  ) =>
    new WeatherMorningStrategy({
      reader,
      notificationPublisher,
      notificationHistoryReader,
      weatherForecastReader,
      logger: new Logger(WeatherMorningStrategy.name),
    }),
};

export const weeklyAchievementStrategyProvider: FactoryProvider<WeeklyAchievementStrategy> = {
  provide: WeeklyAchievementStrategy,
  inject: [
    WEEKLY_ACHIEVEMENT_STATS_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
    WEEKLY_ACHIEVEMENT_WRITER,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WeeklyAchievementStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<
      typeof WeeklyAchievementStrategy
    >[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof WeeklyAchievementStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof WeeklyAchievementStrategy
    >[0]["notificationHistoryReader"],
    weeklyAchievementWriter: ConstructorParameters<
      typeof WeeklyAchievementStrategy
    >[0]["weeklyAchievementWriter"],
  ) =>
    new WeeklyAchievementStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      weeklyAchievementWriter,
      logger: new Logger(WeeklyAchievementStrategy.name),
    }),
};

export const weeklyReportStrategyProvider: FactoryProvider<WeeklyReportStrategy> = {
  provide: WeeklyReportStrategy,
  inject: [
    SCHEDULED_REMINDER_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WeeklyReportStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof WeeklyReportStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof WeeklyReportStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof WeeklyReportStrategy
    >[0]["notificationHistoryReader"],
  ) =>
    new WeeklyReportStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      logger: new Logger(WeeklyReportStrategy.name),
    }),
};

export const winbackStrategyProvider: FactoryProvider<WinbackStrategy> = {
  provide: WinbackStrategy,
  inject: [
    RE_ENGAGEMENT_READER,
    SCHEDULER_PREFERENCE_READER,
    NotificationPublisher,
    NotificationHistoryReader,
    SCHEDULER_DEDUP,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WinbackStrategy>[0]["reader"],
    preferenceReader: ConstructorParameters<typeof WinbackStrategy>[0]["preferenceReader"],
    notificationPublisher: ConstructorParameters<
      typeof WinbackStrategy
    >[0]["notificationPublisher"],
    notificationHistoryReader: ConstructorParameters<
      typeof WinbackStrategy
    >[0]["notificationHistoryReader"],
    schedulerDedup: ConstructorParameters<typeof WinbackStrategy>[0]["schedulerDedup"],
  ) =>
    new WinbackStrategy({
      reader,
      preferenceReader,
      notificationPublisher,
      notificationHistoryReader,
      schedulerDedup,
      logger: new Logger(WinbackStrategy.name),
    }),
};

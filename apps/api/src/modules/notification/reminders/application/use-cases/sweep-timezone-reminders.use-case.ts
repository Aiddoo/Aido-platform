import { minutesToSweep } from "#api/shared/application/minutes-to-sweep";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import type { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

import {
  FIRST_DAY_OF_MONTH,
  isWithinScheduleWindow,
  MONDAY,
  NOTIFICATION_SCHEDULE,
  REMINDER_LATE_LIMIT_MINUTES,
  REMINDER_LATE_SKIP_REASON,
} from "../../domain/notification-schedule.domain-service.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import type { SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type {
  ReminderHourChangedJobData,
  SocialDigestJobData,
  TimezoneReminderEnqueuerPort,
} from "../ports/timezone-reminder-enqueuer.port.js";
import { ReminderAlerts } from "../reminders.alerts.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";
import type { SendEveningReminderUseCase } from "./send-evening-reminder.use-case.js";
import type { SendLunchNudgeUseCase } from "./send-lunch-nudge.use-case.js";
import type { SendMonthlyReportUseCase } from "./send-monthly-report.use-case.js";
import type { SendMorningReminderUseCase } from "./send-morning-reminder.use-case.js";
import type { SendNudgeSuggestUseCase } from "./send-nudge-suggest.use-case.js";
import type { SendOnboardingUseCase } from "./send-onboarding.use-case.js";
import type { SendSocialDigestUseCase } from "./send-social-digest.use-case.js";
import type { SendStreakAtRiskUseCase } from "./send-streak-at-risk.use-case.js";
import type { SendWeatherEveningUseCase } from "./send-weather-evening.use-case.js";
import type { SendWeatherMorningUseCase } from "./send-weather-morning.use-case.js";
import type { SendWeeklyAchievementUseCase } from "./send-weekly-achievement.use-case.js";
import type { SendWeeklyReportUseCase } from "./send-weekly-report.use-case.js";
import type { SendWinbackUseCase } from "./send-winback.use-case.js";

// 스케줄 key와 따로 두는 커서 key. 바꾸면 따라잡기 기록을 잃는다
export const TIMEZONE_REMINDER_SWEEP_CURSOR_KEY = "tz-reminder-sweep";

interface SweepTimezoneRemindersDependencies {
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findActiveTimezones">;
  readonly enqueuer: Pick<TimezoneReminderEnqueuerPort, "enqueueSocialDigest">;
  readonly sweepCursor: Pick<SweepCursorPort, "findLastCompletedAt" | "markCompleted">;
  readonly clock: Pick<ClockPort, "now">;
  readonly morningReminder: Pick<SendMorningReminderUseCase, "execute">;
  readonly eveningReminder: Pick<SendEveningReminderUseCase, "execute">;
  readonly weeklyReport: Pick<SendWeeklyReportUseCase, "execute">;
  readonly monthlyReport: Pick<SendMonthlyReportUseCase, "execute">;
  readonly weeklyAchievement: Pick<SendWeeklyAchievementUseCase, "execute">;
  readonly winback: Pick<SendWinbackUseCase, "execute">;
  readonly nudgeSuggest: Pick<SendNudgeSuggestUseCase, "execute">;
  readonly socialDigest: Pick<SendSocialDigestUseCase, "execute">;
  readonly lunchNudge: Pick<SendLunchNudgeUseCase, "execute">;
  readonly streakAtRisk: Pick<SendStreakAtRiskUseCase, "execute">;
  readonly onboarding: Pick<SendOnboardingUseCase, "execute">;
  readonly weatherMorning: Pick<SendWeatherMorningUseCase, "execute">;
  readonly weatherEvening: Pick<SendWeatherEveningUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "error" | "log" | "warn">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
}

/**
 * 매분 활성 시간대마다 현지 시:분에 맞는 전략을 실행한다.
 * 마지막으로 끝낸 분 다음부터 지금 분까지(최대 15분)를 차례로 처리해 worker가 멈춘 사이의 분도 보낸다.
 */
export class SweepTimezoneRemindersUseCase {
  readonly #dependencies: SweepTimezoneRemindersDependencies;

  constructor(dependencies: SweepTimezoneRemindersDependencies) {
    this.#dependencies = dependencies;
  }

  async handleMinuteSweep(): Promise<void> {
    const { logger, sweepCursor } = this.#dependencies;
    logger.log({ event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_STARTED });

    try {
      const lastCompletedAt = await sweepCursor.findLastCompletedAt(
        TIMEZONE_REMINDER_SWEEP_CURSOR_KEY,
      );
      const minutes = minutesToSweep({
        lastCompletedAt,
        now: this.#dependencies.clock.now(),
        maxCatchUpMinutes: REMINDER_LATE_LIMIT_MINUTES,
      });
      const skippedMinutes = countSkippedMinutes(lastCompletedAt, minutes);
      // worker가 REMINDER_LATE_LIMIT_MINUTES(15분)보다 오래 멈춰 그보다 앞선 분의 정시 알림을 버렸다
      if (skippedMinutes > 0) {
        logger.warn({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_MINUTES_SKIPPED,
          reason: REMINDER_LATE_SKIP_REASON,
          skippedMinutes,
        });
        this.#dependencies.alert.raise({
          ...ReminderAlerts.SWEEP_CATCH_UP_CAPPED,
          details: { skippedMinutes, maxCatchUpMinutes: REMINDER_LATE_LIMIT_MINUTES },
        });
      }

      const timezones = await this.#dependencies.preferenceReader.findActiveTimezones();
      for (const minute of minutes) {
        await this.#sweepMinute(minute, timezones);
        // 분을 끝낸 뒤에만 옮겨 중간에 멈추면 그 분부터 다시 처리한다. 다시 보내는 사용자는 일간 중복 방지가 막는다
        await sweepCursor.markCompleted(TIMEZONE_REMINDER_SWEEP_CURSOR_KEY, minute);
      }

      logger.log({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_COMPLETED,
        timezoneCount: timezones.length,
        minuteCount: minutes.length,
      });
    } catch {
      logger.error({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_FAILED,
        errorType: "sweep-execution",
      });
    }
  }

  /** 바꾼 리마인더 시각이 지금이면 그 사용자에게 바로 보낸다. */
  async handleReminderHourChanged(payload: ReminderHourChangedJobData): Promise<void> {
    try {
      const local = this.#dependencies.clock.now().toZonedDateTimeISO(payload.timezone);
      const ctx = timezoneContextAt(payload.timezone, local, payload.userId);
      const { localHour, localMinute } = ctx;

      const morningMinute = payload.morningReminderMinute ?? 0;
      if (
        payload.morningReminderHour != null &&
        payload.morningReminderHour === localHour &&
        morningMinute === localMinute
      ) {
        this.#dependencies.logger.log({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_CATCH_UP_MORNING,
          userId: payload.userId,
          localHour,
          localMinute,
        });
        await this.#dependencies.morningReminder.execute(ctx);
      }

      const eveningMinute = payload.eveningReminderMinute ?? 0;
      if (
        payload.eveningReminderHour != null &&
        payload.eveningReminderHour === localHour &&
        eveningMinute === localMinute
      ) {
        this.#dependencies.logger.log({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_CATCH_UP_EVENING,
          userId: payload.userId,
          localHour,
          localMinute,
        });
        await this.#dependencies.eveningReminder.execute(ctx);
      }
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_CATCH_UP_FAILED,
        userId: payload.userId,
        errorType: "catch-up-execution",
      });
    }
  }

  async handleSocialDigest(payload: SocialDigestJobData): Promise<void> {
    try {
      if (!payload.recipientUserIds?.length) {
        this.#dependencies.logger.warn({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_LEGACY_DIGEST_SKIPPED,
          timezone: payload.timezone,
        });
        return;
      }
      const local = this.#dependencies.clock.now().toZonedDateTimeISO(payload.timezone);
      const ctx = { ...timezoneContextAt(payload.timezone, local), localHour: 0, localMinute: 0 };
      await this.#dependencies.socialDigest.execute(ctx, payload.recipientUserIds);
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_DIGEST_FAILED,
        timezone: payload.timezone,
        errorType: "digest-execution",
      });
    }
  }

  async #sweepMinute(minute: Temporal.Instant, timezones: readonly string[]): Promise<void> {
    const results = await Promise.allSettled(
      timezones.map(async (tz) => this.#sweepTimezone(tz, minute.toZonedDateTimeISO(tz))),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        this.#dependencies.logger.error({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_TIMEZONE_FAILED,
          timezone: timezones[index] ?? "unknown",
          errorType: "strategy-execution",
        });
      }
    });
  }

  async #sweepTimezone(tz: string, local: Temporal.ZonedDateTime): Promise<void> {
    const ctx = timezoneContextAt(tz, local);
    const { localHour, localMinute, dayOfWeek } = ctx;

    await this.#dependencies.morningReminder.execute(ctx);
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.ONBOARDING, localHour, localMinute)) {
      await this.#dependencies.onboarding.execute(ctx);
    }
    const eveningResult = await this.#dependencies.eveningReminder.execute(ctx);

    // 저녁 리마인더를 받은 사용자에게 90분 뒤 소셜 다이제스트를 보낸다
    if (eveningResult.recipientUserIds.length > 0) {
      this.#dependencies.enqueuer.enqueueSocialDigest({
        timezone: tz,
        recipientUserIds: eveningResult.recipientUserIds,
      });
    }

    // 11:30 요약 슬롯: 매월 1일은 프리미엄 월간 리포트가 주간 리포트를 대체한다.
    const isMonthlyReportTime =
      local.day === FIRST_DAY_OF_MONTH &&
      isWithinScheduleWindow(NOTIFICATION_SCHEDULE.MONTHLY_REPORT, localHour, localMinute);
    if (isMonthlyReportTime) {
      await this.#dependencies.monthlyReport.execute(ctx);
    } else if (
      dayOfWeek === MONDAY &&
      isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WEEKLY_REPORT, localHour, localMinute)
    ) {
      await this.#dependencies.weeklyReport.execute(ctx);
    }

    // 월요일 11:30: 무료 사용자 주간 달성 요약 (전략 내부에서 구독 대상 분리)
    if (
      dayOfWeek === MONDAY &&
      isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT, localHour, localMinute)
    ) {
      await this.#dependencies.weeklyAchievement.execute(ctx);
    }
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WINBACK, localHour, localMinute)) {
      await this.#dependencies.winback.execute(ctx);
    }
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.NUDGE_SUGGEST, localHour, localMinute)) {
      await this.#dependencies.nudgeSuggest.execute(ctx);
    }
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.LUNCH_NUDGE, localHour, localMinute)) {
      await this.#dependencies.lunchNudge.execute(ctx);
    }
    // 야간 21:00 시작 전 마지막 넛지
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.STREAK_AT_RISK, localHour, localMinute)) {
      await this.#dependencies.streakAtRisk.execute(ctx);
    }
    // 날씨 알림은 사용자가 고른 시:분을 전략 안에서 맞춘다
    await this.#dependencies.weatherMorning.execute(ctx);
    await this.#dependencies.weatherEvening.execute(ctx);
  }
}

// 처리하는 분의 현지 시각으로 시:분·요일·오늘을 정한다. 늦게 따라잡아도 그 분의 날짜로 보낸다
function timezoneContextAt(
  tz: string,
  local: Temporal.ZonedDateTime,
  userId?: string,
): TimezoneContext {
  const today = local.toPlainDate();
  return {
    tz,
    localHour: local.hour,
    localMinute: local.minute,
    // Temporal은 월=1…일=7, 컨텍스트는 일=0
    dayOfWeek: local.dayOfWeek % 7,
    today,
    tomorrow: today.add({ days: 1 }),
    userId,
  };
}

// 마지막으로 끝낸 분과 이번에 처음 처리하는 분 사이에서 버린 분의 수
function countSkippedMinutes(
  lastCompletedAt: Temporal.Instant | null,
  minutes: readonly Temporal.Instant[],
): number {
  const [first] = minutes;
  if (lastCompletedAt == null || first == null) {
    return 0;
  }
  const last = lastCompletedAt.round({ smallestUnit: "minute", roundingMode: "floor" });
  return Math.max(0, last.until(first, { largestUnit: "minutes" }).minutes - 1);
}

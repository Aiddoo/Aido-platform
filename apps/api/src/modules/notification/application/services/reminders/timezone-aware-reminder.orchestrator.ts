import dayjs from "dayjs";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import {
  FIRST_DAY_OF_MONTH,
  isWithinScheduleWindow,
  MONDAY,
  NOTIFICATION_SCHEDULE,
} from "../../../domain/services/reminders/notification-schedule.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import {
  type ReminderHourChangedJobData,
  type SocialDigestJobData,
  type TimezoneReminderEnqueuerPort,
} from "../../ports/reminders/timezone-reminder-enqueuer.port.js";
import type { EveningReminderStrategy } from "../../strategies/reminders/evening-reminder.strategy.js";
import type { LunchNudgeStrategy } from "../../strategies/reminders/lunch-nudge.strategy.js";
import type { MonthlyReportStrategy } from "../../strategies/reminders/monthly-report.strategy.js";
import type { MorningReminderStrategy } from "../../strategies/reminders/morning-reminder.strategy.js";
import type { NudgeSuggestStrategy } from "../../strategies/reminders/nudge-suggest.strategy.js";
import type { OnboardingStrategy } from "../../strategies/reminders/onboarding.strategy.js";
import type { SocialDigestStrategy } from "../../strategies/reminders/social-digest.strategy.js";
import type { StreakAtRiskStrategy } from "../../strategies/reminders/streak-at-risk.strategy.js";
import type { WeatherEveningStrategy } from "../../strategies/reminders/weather-evening.strategy.js";
import type { WeatherMorningStrategy } from "../../strategies/reminders/weather-morning.strategy.js";
import type { WeeklyAchievementStrategy } from "../../strategies/reminders/weekly-achievement.strategy.js";
import type { WeeklyReportStrategy } from "../../strategies/reminders/weekly-report.strategy.js";
import type { WinbackStrategy } from "../../strategies/reminders/winback.strategy.js";

/**
 * 타임존 인식 리마인더 — Every-Minute Sweep 오케스트레이터.
 *
 * 매분 실행되어 각 타임존별 로컬 시간(시:분)을 확인하고, 해당 시간에 맞는
 * Strategy를 실행한다. 비즈니스 로직은 각 Strategy에 위임한다.
 *
 * - 활성 타임존 조회는 SchedulerPreferenceReaderPort(캐시 스루)에 위임
 * - 큐 등록/발송은 TimezoneReminderEnqueuerPort에 위임 (DIP)
 */
interface TimezoneAwareReminderOrchestratorDependencies {
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findActiveTimezones">;
  readonly enqueuer: Pick<
    TimezoneReminderEnqueuerPort,
    "enqueueSocialDigest" | "registerSweepScheduler"
  >;
  readonly morningReminder: Pick<MorningReminderStrategy, "execute">;
  readonly eveningReminder: Pick<EveningReminderStrategy, "execute">;
  readonly weeklyReport: Pick<WeeklyReportStrategy, "execute">;
  readonly monthlyReport: Pick<MonthlyReportStrategy, "execute">;
  readonly weeklyAchievement: Pick<WeeklyAchievementStrategy, "execute">;
  readonly winback: Pick<WinbackStrategy, "execute">;
  readonly nudgeSuggest: Pick<NudgeSuggestStrategy, "execute">;
  readonly socialDigest: Pick<SocialDigestStrategy, "execute">;
  readonly lunchNudge: Pick<LunchNudgeStrategy, "execute">;
  readonly streakAtRisk: Pick<StreakAtRiskStrategy, "execute">;
  readonly onboarding: Pick<OnboardingStrategy, "execute">;
  readonly weatherMorning: Pick<WeatherMorningStrategy, "execute">;
  readonly weatherEvening: Pick<WeatherEveningStrategy, "execute">;
  readonly logger: Pick<ApplicationLogger, "error" | "log" | "warn">;
}

export class TimezoneAwareReminderOrchestrator {
  readonly #dependencies: TimezoneAwareReminderOrchestratorDependencies;

  constructor(dependencies: TimezoneAwareReminderOrchestratorDependencies) {
    this.#dependencies = dependencies;
  }

  /** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
  schedulerRegistration: Promise<void> = Promise.resolve();

  onModuleInit(): void {
    // Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
    this.schedulerRegistration = this.#registerSweepScheduler();
  }

  async #registerSweepScheduler(): Promise<void> {
    try {
      await this.#dependencies.enqueuer.registerSweepScheduler();
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_REGISTRATION_FAILED,
        errorType: "scheduler-registration",
      });
    }
  }

  /**
   * 매분 실행 — Every-Minute Sweep 패턴
   *
   * 1. 활성화된 고유 타임존 목록 조회 (캐시 스루)
   * 2. 각 타임존의 현재 로컬 시간(시:분) 확인
   * 3. 해당 시간에 맞는 Strategy 실행
   */
  async handleMinuteSweep(): Promise<void> {
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_STARTED,
    });

    try {
      const now = new Date();

      const tzList = await this.#dependencies.preferenceReader.findActiveTimezones();

      // 각 타임존별 Strategy를 병렬 처리
      const tasks = tzList.map((tz) => {
        const local = dayjs(now).tz(tz);
        const localHour = local.hour();
        const localMinute = local.minute();
        return this.#processTimezone(tz, localHour, localMinute);
      });

      const results = await Promise.allSettled(tasks);
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const tz = tzList[index] ?? "unknown";
          this.#dependencies.logger.error({
            event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_TIMEZONE_FAILED,
            timezone: tz,
            errorType: "strategy-execution",
          });
        }
      });

      this.#dependencies.logger.log({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_COMPLETED,
        timezoneCount: tzList.length,
      });
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_SWEEP_FAILED,
        errorType: "sweep-execution",
      });
    }
  }

  /**
   * 리마인더 시간 변경 핸들러 — Catch-up 패턴
   */
  async handleReminderHourChanged(payload: ReminderHourChangedJobData): Promise<void> {
    try {
      const now = dayjs().tz(payload.timezone);
      const localHour = now.hour();
      const localMinute = now.minute();

      const ctx = this.#buildContext(payload.timezone, localHour, localMinute, payload.userId);

      const morningMinute = payload.morningReminderMinute ?? 0;
      if (
        payload.morningReminderHour !== undefined &&
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
        payload.eveningReminderHour !== undefined &&
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

  /**
   * Social Digest delayed job 핸들러
   */
  async handleSocialDigest(payload: SocialDigestJobData): Promise<void> {
    try {
      if (!payload.recipientUserIds?.length) {
        this.#dependencies.logger.warn({
          event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_LEGACY_DIGEST_SKIPPED,
          timezone: payload.timezone,
        });
        return;
      }
      const ctx = this.#buildContext(payload.timezone, 0, 0);
      await this.#dependencies.socialDigest.execute(ctx, payload.recipientUserIds);
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_DIGEST_FAILED,
        timezone: payload.timezone,
        errorType: "digest-execution",
      });
    }
  }

  async #processTimezone(tz: string, localHour: number, localMinute: number): Promise<void> {
    const local = dayjs().tz(tz);
    const dayOfWeek = local.day(); // 0=일, 1=월
    const ctx = this.#buildContext(tz, localHour, localMinute);

    await this.#dependencies.morningReminder.execute(ctx);
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.ONBOARDING, localHour, localMinute)) {
      await this.#dependencies.onboarding.execute(ctx);
    }
    const eveningResult = await this.#dependencies.eveningReminder.execute(ctx);

    // 저녁 리마인더 발송 시 90분 후 Social Digest delayed job 등록
    if (eveningResult.recipientUserIds.length > 0) {
      this.#dependencies.enqueuer.enqueueSocialDigest({
        timezone: tz,
        recipientUserIds: eveningResult.recipientUserIds,
      });
    }

    // 11:30 요약 슬롯: 매월 1일은 프리미엄 월간 리포트가 주간 리포트를 대체한다.
    const dayOfMonth = local.date();
    const isMonthlyReportTime =
      dayOfMonth === FIRST_DAY_OF_MONTH &&
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

    // 로컬 16:00: Win-back
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WINBACK, localHour, localMinute)) {
      await this.#dependencies.winback.execute(ctx);
    }

    // 로컬 15:00: 콕 찌르기 유도
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.NUDGE_SUGGEST, localHour, localMinute)) {
      await this.#dependencies.nudgeSuggest.execute(ctx);
    }

    // 로컬 12:30: 점심 넛지
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.LUNCH_NUDGE, localHour, localMinute)) {
      await this.#dependencies.lunchNudge.execute(ctx);
    }

    // 로컬 20:15: 스트릭 위기 (야간 21:00 시작 전 마지막 넛지)
    if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.STREAK_AT_RISK, localHour, localMinute)) {
      await this.#dependencies.streakAtRisk.execute(ctx);
    }

    // 날씨 알림: 유저별 커스텀 시간 (내부에서 시:분 매칭)
    await this.#dependencies.weatherMorning.execute(ctx);
    await this.#dependencies.weatherEvening.execute(ctx);
  }

  #buildContext(
    tz: string,
    localHour: number,
    localMinute: number,
    userId?: string,
  ): TimezoneContext {
    const local = dayjs().tz(tz);
    const today = todayInTimezone(tz);
    return {
      tz,
      localHour,
      localMinute,
      dayOfWeek: local.day(),
      today,
      tomorrow: addDays(1, today),
      userId,
    };
  }
}

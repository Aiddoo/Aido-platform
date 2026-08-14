import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";

import { toErrorMessage } from "@/shared/application/utils/error-message.util";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import {
	FIRST_DAY_OF_MONTH,
	isWithinScheduleWindow,
	MONDAY,
	NOTIFICATION_SCHEDULE,
} from "../../domain/services/notification-schedule";
import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import {
	type ReminderHourChangedJobData,
	type SocialDigestJobData,
	TIMEZONE_REMINDER_ENQUEUER,
	type TimezoneReminderEnqueuerPort,
} from "../ports/timezone-reminder-enqueuer.port";
import { EveningReminderStrategy } from "../strategies/evening-reminder.strategy";
import { LunchNudgeStrategy } from "../strategies/lunch-nudge.strategy";
import { MonthlyReportStrategy } from "../strategies/monthly-report.strategy";
import { MorningReminderStrategy } from "../strategies/morning-reminder.strategy";
import { NudgeSuggestStrategy } from "../strategies/nudge-suggest.strategy";
import { OnboardingStrategy } from "../strategies/onboarding.strategy";
import { SocialDigestStrategy } from "../strategies/social-digest.strategy";
import { StreakAtRiskStrategy } from "../strategies/streak-at-risk.strategy";
import { WeatherEveningStrategy } from "../strategies/weather-evening.strategy";
import { WeatherMorningStrategy } from "../strategies/weather-morning.strategy";
import { WeeklyAchievementStrategy } from "../strategies/weekly-achievement.strategy";
import { WeeklyReportStrategy } from "../strategies/weekly-report.strategy";
import { WinbackStrategy } from "../strategies/winback.strategy";

/**
 * 타임존 인식 리마인더 — Every-Minute Sweep 오케스트레이터.
 *
 * 매분 실행되어 각 타임존별 로컬 시간(시:분)을 확인하고, 해당 시간에 맞는
 * Strategy를 실행한다. 비즈니스 로직은 각 Strategy에 위임한다.
 *
 * - 활성 타임존 조회는 SchedulerPreferenceReaderPort(캐시 스루)에 위임
 * - 큐 등록/발송은 TimezoneReminderEnqueuerPort에 위임 (DIP)
 */
@Injectable()
export class TimezoneAwareReminderOrchestrator implements OnModuleInit {
	readonly #logger = new Logger(TimezoneAwareReminderOrchestrator.name);

	constructor(
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		@Inject(TIMEZONE_REMINDER_ENQUEUER)
		private readonly enqueuer: TimezoneReminderEnqueuerPort,
		private readonly morningReminder: MorningReminderStrategy,
		private readonly eveningReminder: EveningReminderStrategy,
		private readonly weeklyReport: WeeklyReportStrategy,
		private readonly monthlyReport: MonthlyReportStrategy,
		private readonly weeklyAchievement: WeeklyAchievementStrategy,
		private readonly winback: WinbackStrategy,
		private readonly nudgeSuggest: NudgeSuggestStrategy,
		private readonly socialDigest: SocialDigestStrategy,
		private readonly lunchNudge: LunchNudgeStrategy,
		private readonly streakAtRisk: StreakAtRiskStrategy,
		private readonly onboarding: OnboardingStrategy,
		private readonly weatherMorning: WeatherMorningStrategy,
		private readonly weatherEvening: WeatherEveningStrategy,
	) {}

	/** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
	schedulerRegistration: Promise<void> = Promise.resolve();

	onModuleInit(): void {
		// Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
		this.schedulerRegistration = this.#registerSweepScheduler();
	}

	async #registerSweepScheduler(): Promise<void> {
		try {
			await this.enqueuer.registerSweepScheduler();
		} catch (error: unknown) {
			this.#logger.error(
				`Timezone reminder sweep scheduler registration failed: ${toErrorMessage(error)}`,
			);
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
		this.#logger.log("Starting every-minute sweep reminder job...");

		try {
			const now = new Date();

			const tzList = await this.preferenceReader.findActiveTimezones();

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
					this.#logger.error(
						`Timezone reminder task failed for tz=${tz}: ${result.reason}`,
						result.reason instanceof Error ? result.reason.stack : undefined,
					);
				}
			});

			this.#logger.log("Every-minute sweep reminder job completed");
		} catch (error) {
			this.#logger.error(
				`Sweep reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
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
				this.#logger.log(
					`Catch-up morning reminder for user=${payload.userId}, time=${localHour}:${String(localMinute).padStart(2, "0")}`,
				);
				await this.morningReminder.execute(ctx);
			}

			const eveningMinute = payload.eveningReminderMinute ?? 0;
			if (
				payload.eveningReminderHour !== undefined &&
				payload.eveningReminderHour === localHour &&
				eveningMinute === localMinute
			) {
				this.#logger.log(
					`Catch-up evening reminder for user=${payload.userId}, time=${localHour}:${String(localMinute).padStart(2, "0")}`,
				);
				await this.eveningReminder.execute(ctx);
			}
		} catch (error) {
			this.#logger.error(
				`Catch-up reminder failed for user=${payload.userId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * Social Digest delayed job 핸들러
	 */
	async handleSocialDigest(payload: SocialDigestJobData): Promise<void> {
		try {
			if (!payload.recipientUserIds?.length) {
				this.#logger.warn(
					`Skipping legacy social digest job without recipients: tz=${payload.timezone}`,
				);
				return;
			}
			const ctx = this.#buildContext(payload.timezone, 0, 0);
			await this.socialDigest.execute(ctx, payload.recipientUserIds);
		} catch (error) {
			this.#logger.error(
				`Social digest failed: tz=${payload.timezone}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #processTimezone(tz: string, localHour: number, localMinute: number): Promise<void> {
		const local = dayjs().tz(tz);
		const dayOfWeek = local.day(); // 0=일, 1=월
		const ctx = this.#buildContext(tz, localHour, localMinute);

		await this.morningReminder.execute(ctx);
		if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.ONBOARDING, localHour, localMinute)) {
			await this.onboarding.execute(ctx);
		}
		const eveningResult = await this.eveningReminder.execute(ctx);

		// 저녁 리마인더 발송 시 90분 후 Social Digest delayed job 등록
		if (eveningResult.recipientUserIds.length > 0) {
			this.enqueuer.enqueueSocialDigest({
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
			await this.monthlyReport.execute(ctx);
		} else if (
			dayOfWeek === MONDAY &&
			isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WEEKLY_REPORT, localHour, localMinute)
		) {
			await this.weeklyReport.execute(ctx);
		}

		// 월요일 11:30: 무료 사용자 주간 달성 요약 (전략 내부에서 구독 대상 분리)
		if (
			dayOfWeek === MONDAY &&
			isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT, localHour, localMinute)
		) {
			await this.weeklyAchievement.execute(ctx);
		}

		// 로컬 16:00: Win-back
		if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.WINBACK, localHour, localMinute)) {
			await this.winback.execute(ctx);
		}

		// 로컬 15:00: 콕 찌르기 유도
		if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.NUDGE_SUGGEST, localHour, localMinute)) {
			await this.nudgeSuggest.execute(ctx);
		}

		// 로컬 12:30: 점심 넛지
		if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.LUNCH_NUDGE, localHour, localMinute)) {
			await this.lunchNudge.execute(ctx);
		}

		// 로컬 20:15: 스트릭 위기 (야간 21:00 시작 전 마지막 넛지)
		if (isWithinScheduleWindow(NOTIFICATION_SCHEDULE.STREAK_AT_RISK, localHour, localMinute)) {
			await this.streakAtRisk.execute(ctx);
		}

		// 날씨 알림: 유저별 커스텀 시간 (내부에서 시:분 매칭)
		await this.weatherMorning.execute(ctx);
		await this.weatherEvening.execute(ctx);
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

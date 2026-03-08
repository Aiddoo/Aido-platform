import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";

import {
	type ReminderHourChangedJobData,
	TimezoneReminderProcessor,
	TimezoneReminderQueueService,
} from "../queue";
import type { TimezoneContext } from "./strategies";
import { EveningReminderStrategy } from "./strategies/evening-reminder.strategy";
import { MonthlyReportStrategy } from "./strategies/monthly-report.strategy";
import { MorningReminderStrategy } from "./strategies/morning-reminder.strategy";
import { NudgeSuggestStrategy } from "./strategies/nudge-suggest.strategy";
import { SocialDigestStrategy } from "./strategies/social-digest.strategy";
import { WeeklyAchievementStrategy } from "./strategies/weekly-achievement.strategy";
import { WeeklyReportStrategy } from "./strategies/weekly-report.strategy";
import { WinbackStrategy } from "./strategies/winback.strategy";

/**
 * 타임존 인식 리마인더 — Every-Minute Sweep 오케스트레이터
 *
 * 매분 실행되어 각 타임존별 로컬 시간(시:분)을 확인하고,
 * 해당 시간에 맞는 Strategy를 실행합니다.
 *
 * 비즈니스 로직은 각 Strategy에 위임합니다.
 */
@Injectable()
export class TimezoneAwareReminderJob implements OnModuleInit {
	readonly #logger = new Logger(TimezoneAwareReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly queueService: TimezoneReminderQueueService,
		private readonly processor: TimezoneReminderProcessor,
		private readonly morningReminder: MorningReminderStrategy,
		private readonly eveningReminder: EveningReminderStrategy,
		private readonly weeklyReport: WeeklyReportStrategy,
		private readonly monthlyReport: MonthlyReportStrategy,
		private readonly weeklyAchievement: WeeklyAchievementStrategy,
		private readonly winback: WinbackStrategy,
		private readonly nudgeSuggest: NudgeSuggestStrategy,
		private readonly socialDigest: SocialDigestStrategy,
	) {}

	async onModuleInit(): Promise<void> {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setReminderJob(this);

		await this.queueService.registerSweepScheduler();
	}

	/**
	 * 매분 실행 — Every-Minute Sweep 패턴
	 *
	 * 1. DB에서 활성화된 고유 타임존 목록 조회 (1 query)
	 * 2. 각 타임존의 현재 로컬 시간(시:분) 확인
	 * 3. 해당 시간에 맞는 Strategy 실행
	 */
	async handleHourlySweep(): Promise<void> {
		this.#logger.log("Starting every-minute sweep reminder job...");

		try {
			const now = new Date();

			// 1. 고유 타임존 목록 조회 (pushEnabled=true인 사용자만)
			const timezones = await this.database.userPreference.findMany({
				where: { pushEnabled: true },
				select: { timezone: true },
				distinct: ["timezone"],
			});

			// 2. 각 타임존별 Strategy를 병렬 처리
			const tasks = timezones.map(({ timezone: tz }) => {
				const local = dayjs(now).tz(tz);
				const localHour = local.hour();
				const localMinute = local.minute();
				return this.#processTimezone(tz, localHour, localMinute);
			});

			const results = await Promise.allSettled(tasks);
			results.forEach((result, index) => {
				if (result.status === "rejected") {
					const tz = timezones[index]?.timezone ?? "unknown";
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
	async handleReminderHourChanged(
		payload: ReminderHourChangedJobData,
	): Promise<void> {
		try {
			const now = dayjs().tz(payload.timezone);
			const localHour = now.hour();
			const localMinute = now.minute();

			const ctx = this.#buildContext(
				payload.timezone,
				localHour,
				localMinute,
				payload.userId,
			);

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
	async handleSocialDigest(payload: { timezone: string }): Promise<void> {
		try {
			const ctx = this.#buildContext(payload.timezone, 0, 0);
			await this.socialDigest.execute(ctx);
		} catch (error) {
			this.#logger.error(
				`Social digest failed: tz=${payload.timezone}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #processTimezone(
		tz: string,
		localHour: number,
		localMinute: number,
	): Promise<void> {
		const local = dayjs().tz(tz);
		const dayOfWeek = local.day(); // 0=일, 1=월
		const ctx = this.#buildContext(tz, localHour, localMinute);

		await this.morningReminder.execute(ctx);
		const eveningResult = await this.eveningReminder.execute(ctx);

		// 저녁 리마인더 발송 시 30분 후 Social Digest delayed job 등록
		if (eveningResult.sent > 0) {
			this.queueService.enqueueSocialDigest({ timezone: tz });
		}

		// 월요일 아침: 주간 리포트
		if (dayOfWeek === 1) {
			await this.weeklyReport.execute(ctx);
		}

		// 매월 1일: 월간 리포트
		const dayOfMonth = local.date();
		if (dayOfMonth === 1) {
			await this.monthlyReport.execute(ctx);
		}

		// 일요일 저녁: 주간 달성 배지
		if (dayOfWeek === 0) {
			await this.weeklyAchievement.execute(ctx);
		}

		// 로컬 12:00: Win-back
		if (localHour === 12 && localMinute === 0) {
			await this.winback.execute(ctx);
		}

		// 로컬 14:00: 콕 찌르기 유도
		if (localHour === 14 && localMinute === 0) {
			await this.nudgeSuggest.execute(ctx);
		}
	}

	#buildContext(
		tz: string,
		localHour: number,
		localMinute: number,
		userId?: string,
	): TimezoneContext {
		const local = dayjs().tz(tz);
		return {
			tz,
			localHour,
			localMinute,
			dayOfWeek: local.day(),
			today: new Date(),
			tomorrow: new Date(),
			userId,
		};
	}
}

import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";

import { CacheService } from "@/common/cache/cache.service";
import { addDays } from "@/common/date/utils/arithmetic";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";

import { NOTIFICATION_SCHEDULE } from "../constants/reminder.constants";
import {
	type ReminderHourChangedJobData,
	TimezoneReminderProcessor,
	TimezoneReminderQueueService,
} from "../queue";
import type { TimezoneContext } from "./strategies";
import { EveningReminderStrategy } from "./strategies/evening-reminder.strategy";
import { LunchNudgeStrategy } from "./strategies/lunch-nudge.strategy";
import { MonthlyReportStrategy } from "./strategies/monthly-report.strategy";
import { MorningReminderStrategy } from "./strategies/morning-reminder.strategy";
import { NudgeSuggestStrategy } from "./strategies/nudge-suggest.strategy";
import { SocialDigestStrategy } from "./strategies/social-digest.strategy";
import { StreakAtRiskStrategy } from "./strategies/streak-at-risk.strategy";
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
		private readonly cacheService: CacheService,
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
		private readonly lunchNudge: LunchNudgeStrategy,
		private readonly streakAtRisk: StreakAtRiskStrategy,
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
	async handleMinuteSweep(): Promise<void> {
		this.#logger.log("Starting every-minute sweep reminder job...");

		try {
			const now = new Date();

			// 1. 고유 타임존 목록 조회 (pushEnabled=true인 사용자만, 5분 캐시)
			const tzList = await this.cacheService.wrapActiveTimezones(async () => {
				const rows = await this.database.userPreference.findMany({
					where: { pushEnabled: true },
					select: { timezone: true },
					distinct: ["timezone"],
				});
				return rows.map((r) => r.timezone);
			});

			// 2. 각 타임존별 Strategy를 병렬 처리
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

			// 3. WeeklyAchievement: pushEnabled 유저 없는 TZ도 뱃지 기록 생성
			await this.#processWeeklyAchievementCatchUp(now, tzList);

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

		// 월요일 09:00: 주간 리포트 (아침 리마인더와 겹침 방지)
		if (
			dayOfWeek === 1 &&
			localHour === NOTIFICATION_SCHEDULE.WEEKLY_REPORT.hour &&
			localMinute === NOTIFICATION_SCHEDULE.WEEKLY_REPORT.minute
		) {
			await this.weeklyReport.execute(ctx);
		}

		// 매월 1일 10:00: 월간 리포트 (아침/주간과 겹침 방지)
		const dayOfMonth = local.date();
		if (
			dayOfMonth === 1 &&
			localHour === NOTIFICATION_SCHEDULE.MONTHLY_REPORT.hour &&
			localMinute === NOTIFICATION_SCHEDULE.MONTHLY_REPORT.minute
		) {
			await this.monthlyReport.execute(ctx);
		}

		// 월요일 07:00: 주간 달성 배지 (이전 주 전체 집계, 아침 리마인더 전 발송)
		if (
			dayOfWeek === 1 &&
			localHour === NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT.hour &&
			localMinute === NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT.minute
		) {
			await this.weeklyAchievement.execute(ctx);
		}

		// 로컬 12:00: Win-back
		if (
			localHour === NOTIFICATION_SCHEDULE.WINBACK.hour &&
			localMinute === NOTIFICATION_SCHEDULE.WINBACK.minute
		) {
			await this.winback.execute(ctx);
		}

		// 로컬 14:00: 콕 찌르기 유도
		if (
			localHour === NOTIFICATION_SCHEDULE.NUDGE_SUGGEST.hour &&
			localMinute === NOTIFICATION_SCHEDULE.NUDGE_SUGGEST.minute
		) {
			await this.nudgeSuggest.execute(ctx);
		}

		// 로컬 12:30: 점심 넛지
		if (
			localHour === NOTIFICATION_SCHEDULE.LUNCH_NUDGE.hour &&
			localMinute === NOTIFICATION_SCHEDULE.LUNCH_NUDGE.minute
		) {
			await this.lunchNudge.execute(ctx);
		}

		// 로컬 21:00: 스트릭 위기
		if (
			localHour === NOTIFICATION_SCHEDULE.STREAK_AT_RISK.hour &&
			localMinute === NOTIFICATION_SCHEDULE.STREAK_AT_RISK.minute
		) {
			await this.streakAtRisk.execute(ctx);
		}
	}

	/**
	 * WeeklyAchievement 보정 — pushEnabled 유저가 없는 타임존에서도 뱃지 기록 생성
	 *
	 * 오케스트레이터가 pushEnabled=true 유저의 TZ만 스윕하므로,
	 * pushEnabled 유저가 0명인 TZ의 유저들은 주간 뱃지 집계에서 누락됨.
	 * 이 메서드는 누락된 TZ 중 월요일 07:00인 TZ에 대해 WeeklyAchievement만 실행.
	 */
	async #processWeeklyAchievementCatchUp(
		now: Date,
		pushEnabledTzList: string[],
	): Promise<void> {
		const pushEnabledSet = new Set(pushEnabledTzList);

		const allTzList = await this.cacheService.wrapAllTimezones(async () => {
			const rows = await this.database.userPreference.findMany({
				select: { timezone: true },
				distinct: ["timezone"],
			});
			return rows.map((r) => r.timezone);
		});

		const missingTzList = allTzList.filter((tz) => !pushEnabledSet.has(tz));
		if (missingTzList.length === 0) return;

		const eligibleTzData = missingTzList
			.map((tz) => ({ tz, local: dayjs(now).tz(tz) }))
			.filter(
				({ local }) =>
					local.day() === 1 &&
					local.hour() === NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT.hour &&
					local.minute() === NOTIFICATION_SCHEDULE.WEEKLY_ACHIEVEMENT.minute,
			);

		if (eligibleTzData.length === 0) return;

		const tasks = eligibleTzData.map(({ tz, local }) => {
			const ctx = this.#buildContext(tz, local.hour(), local.minute());
			return this.weeklyAchievement.execute(ctx);
		});

		const results = await Promise.allSettled(tasks);
		results.forEach((result, index) => {
			if (result.status === "rejected") {
				const tz = eligibleTzData[index]?.tz ?? "unknown";
				this.#logger.error(
					`WeeklyAchievement catch-up failed for tz=${tz}: ${result.reason}`,
					result.reason instanceof Error ? result.reason.stack : undefined,
				);
			}
		});
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

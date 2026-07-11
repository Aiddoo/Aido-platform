import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	NotificationMessageBuilder,
	NotificationService,
} from "@/notification";
import { previousIsoWeekRange } from "@/shared/domain/date/utils/range";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { WeeklyAchievementFacade } from "@/weekly-achievement";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import {
	WEEKLY_ACHIEVEMENT_STATS_READER,
	type WeeklyAchievementStatsReaderPort,
} from "../ports/weekly-achievement-stats-reader.port";

@Injectable()
export class WeeklyAchievementStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WeeklyAchievementStrategy.name);

	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_STATS_READER)
		private readonly reader: WeeklyAchievementStatsReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationService,
		private readonly weeklyAchievementFacade: WeeklyAchievementFacade,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);

		// 월요일 실행 → 이전 주(월~일) 집계
		const { start, end, isoYear, isoWeek } = previousIsoWeekRange(today);

		// ─── A. DB 집계 (모든 유저, pushEnabled 무관) ──────────────
		const [totalByUser, completedByUser] = await Promise.all([
			this.reader.groupTotalTodosByUser({
				tz,
				periodStart: start,
				periodEnd: end,
			}),
			this.reader.groupCompletedTodosByUser({
				tz,
				periodStart: start,
				periodEnd: end,
			}),
		]);

		if (totalByUser.length === 0) {
			return { sent: 0 };
		}

		const completedMap = new Map(
			completedByUser.map((g) => [g.userId, g.count]),
		);

		const records = totalByUser.map((g) => ({
			userId: g.userId,
			year: isoYear,
			week: isoWeek,
			totalTodos: g.count,
			completedTodos: completedMap.get(g.userId) ?? 0,
			achievedAt: today,
		}));

		// ─── B. 기록 저장 (모든 유저 — pushEnabled/dedup 무관) ─────
		await this.weeklyAchievementFacade.upsertMany(records);

		// ─── C. 알림 발송 (completed > 0 + dedup) ────
		const notifiableUserIds = records
			.filter((r) => r.completedTodos > 0)
			.map((r) => r.userId);

		if (notifiableUserIds.length === 0) {
			return { sent: 0 };
		}

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: notifiableUserIds,
				type: "WEEKLY_ACHIEVEMENT",
				notificationDate: today,
			});

		const finalRecords = records.filter(
			(r) => r.completedTodos > 0 && !alreadyNotified.has(r.userId),
		);

		if (finalRecords.length === 0) {
			return { sent: 0 };
		}

		const locales = await this.preferenceReader.findUserLocales(
			finalRecords.map((r) => r.userId),
		);
		const notifications = finalRecords.map((r) => {
			const message = NotificationMessageBuilder.weeklyAchievement(
				r.completedTodos,
				r.totalTodos,
				locales.get(r.userId) ?? "ko",
			);
			return {
				userId: r.userId,
				type: "WEEKLY_ACHIEVEMENT" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);

		this.#logger.log(
			`Weekly achievement: tz=${tz}, records=${records.length}, sent=${notifications.length}`,
		);
		return { sent: notifications.length };
	}
}

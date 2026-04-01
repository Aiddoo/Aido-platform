import { Injectable, Logger } from "@nestjs/common";

import { previousIsoWeekRange } from "@/common/date/utils/range";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { WeeklyAchievementService } from "@/modules/weekly-achievement/weekly-achievement.service";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

@Injectable()
export class WeeklyAchievementStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WeeklyAchievementStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		private readonly weeklyAchievementService: WeeklyAchievementService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);

		// 월요일 실행 → 이전 주(월~일) 집계
		const { start, end, isoYear, isoWeek } = previousIsoWeekRange(today);
		const weekRange = { gte: start, lt: end };

		// ─── A. DB 집계 (모든 유저, pushEnabled 무관) ──────────────
		const [totalByUser, completedByUser] = await Promise.all([
			this.database.todo.groupBy({
				by: ["userId"],
				where: {
					startDate: weekRange,
					user: { preference: { timezone: tz } },
				},
				_count: { id: true },
			}),
			this.database.todo.groupBy({
				by: ["userId"],
				where: {
					startDate: weekRange,
					completed: true,
					user: { preference: { timezone: tz } },
				},
				_count: { id: true },
			}),
		]);

		if (totalByUser.length === 0) {
			return { sent: 0 };
		}

		const completedMap = new Map(
			completedByUser.map((g) => [g.userId, g._count.id]),
		);

		const records = totalByUser.map((g) => ({
			userId: g.userId,
			year: isoYear,
			week: isoWeek,
			totalTodos: g._count.id,
			completedTodos: completedMap.get(g.userId) ?? 0,
			achievedAt: today,
		}));

		// ─── B. 기록 저장 (모든 유저 — pushEnabled/dedup 무관) ─────
		await this.weeklyAchievementService.upsertMany(records);

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

		const notifications = finalRecords.map((r) => {
			const message = NotificationMessageBuilder.weeklyAchievement(
				r.completedTodos,
				r.totalTodos,
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

import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { WeeklyAchievementService } from "@/modules/weekly-achievement/weekly-achievement.service";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

@Injectable()
export class WeeklyAchievementStrategy {
	readonly #logger = new Logger(WeeklyAchievementStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		private readonly weeklyAchievementService: WeeklyAchievementService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);

		// 요일 무관하게 항상 정확한 월~일 범위
		const mondayOfWeek = dayjs.utc(today).isoWeekday(1).startOf("day").toDate();
		const nextMonday = dayjs
			.utc(today)
			.isoWeekday(1)
			.add(7, "day")
			.startOf("day")
			.toDate();

		// 오케스트레이터가 일요일 20:00에만 호출 → 전체 pushEnabled 유저 대상
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
				todos: {
					some: {
						startDate: { gte: mondayOfWeek, lt: nextMonday },
						completed: true,
					},
				},
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: mondayOfWeek, lt: nextMonday } },
					select: { completed: true },
				},
			},
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WEEKLY_ACHIEVEMENT",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		// ISO 주차 계산
		const isoYear = dayjs.utc(today).isoWeekYear();
		const isoWeek = dayjs.utc(today).isoWeek();

		// 인메모리 집계 + DB 적재
		const notifications = filteredUsers.map((user) => {
			const totalCount = user.todos.length;
			const completedCount = user.todos.filter((t) => t.completed).length;

			const message = NotificationMessageBuilder.weeklyAchievement(
				completedCount,
				totalCount,
			);

			return {
				userId: user.id,
				type: "WEEKLY_ACHIEVEMENT" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
				totalCount,
				completedCount,
			};
		});

		// 주간 달성 기록 배치 upsert (알림 발송과 병렬)
		await Promise.all([
			this.notificationService.createAndSendBatch(
				notifications.map(({ totalCount, completedCount, ...n }) => n),
			),
			this.weeklyAchievementService.upsertMany(
				notifications.map((n) => ({
					userId: n.userId,
					year: isoYear,
					week: isoWeek,
					totalTodos: n.totalCount,
					completedTodos: n.completedCount,
					achievedAt: today,
				})),
			),
		]);
		this.#logger.log(
			`Weekly achievement: tz=${tz}, count=${notifications.length}`,
		);
		return { sent: notifications.length };
	}
}

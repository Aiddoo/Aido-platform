import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

@Injectable()
export class WeeklyAchievementStrategy {
	readonly #logger = new Logger(WeeklyAchievementStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const mondayOfWeek = dayjs.utc(today).subtract(6, "day").toDate();
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		// 오케스트레이터가 일요일 20:00에만 호출 → 전체 pushEnabled 유저 대상
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
				todos: {
					some: {
						startDate: { gte: mondayOfWeek, lt: tomorrow },
						completed: true,
					},
				},
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: mondayOfWeek, lt: tomorrow } },
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

		// 인메모리 집계
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
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(
			`Weekly achievement: tz=${tz}, count=${notifications.length}`,
		);
		return { sent: notifications.length };
	}
}

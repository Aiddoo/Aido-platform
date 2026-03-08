import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

@Injectable()
export class WeeklyReportStrategy {
	readonly #logger = new Logger(WeeklyReportStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const weekAgo = dayjs.utc(today).subtract(7, "day").toDate();

		// 오케스트레이터가 월요일 09:00에만 호출 → 전체 pushEnabled 유저 대상
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
				todos: { some: { startDate: { gte: weekAgo, lt: today } } },
			},
			select: { id: true },
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WEEKLY_REPORT",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		const message = NotificationMessageBuilder.weeklyReport();
		const notifications = filteredUsers.map((user) => ({
			userId: user.id,
			type: "WEEKLY_REPORT" as const,
			title: message.title,
			body: message.body,
			notificationDate: today,
		}));

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Weekly report: tz=${tz}, count=${notifications.length}`);
		return { sent: notifications.length };
	}
}

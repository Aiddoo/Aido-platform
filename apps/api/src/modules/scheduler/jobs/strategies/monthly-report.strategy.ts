import { Injectable, Logger } from "@nestjs/common";

import { subtractMonths } from "@/common/date/utils/arithmetic";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

@Injectable()
export class MonthlyReportStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(MonthlyReportStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const monthAgo = subtractMonths(1, today);

		// 오케스트레이터가 매월 1일 10:00에만 호출 → 프리미엄 pushEnabled 유저 대상
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				todos: { some: { startDate: { gte: monthAgo, lt: today } } },
			},
			select: { id: true },
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "MONTHLY_REPORT",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		const message = NotificationMessageBuilder.monthlyReport();
		const notifications = filteredUsers.map((user) => ({
			userId: user.id,
			type: "MONTHLY_REPORT" as const,
			title: message.title,
			body: message.body,
			notificationDate: today,
		}));

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Monthly report: tz=${tz}, count=${notifications.length}`);
		return { sent: notifications.length };
	}
}

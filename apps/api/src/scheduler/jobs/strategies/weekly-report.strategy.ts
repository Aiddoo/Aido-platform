import { Injectable, Logger } from "@nestjs/common";
import { NotificationService } from "@/notification/notification.service";
import { NotificationMessageBuilder } from "@/notification/templates/notification-templates";
import {
	createLocaleMessageCache,
	fetchUserLocales,
} from "@/notification/templates/user-locale.util";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

@Injectable()
export class WeeklyReportStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WeeklyReportStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const weekAgo = subtractDays(7, today);

		// 오케스트레이터가 월요일 09:00에만 호출 → 프리미엄 유저 대상
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz },
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
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

		const locales = await fetchUserLocales(
			this.database,
			filteredUsers.map((u) => u.id),
		);
		const getMessage = createLocaleMessageCache((locale) =>
			NotificationMessageBuilder.weeklyReport(locale),
		);
		const notifications = filteredUsers.map((user) => {
			const message = getMessage(locales.get(user.id) ?? "ko");
			return {
				userId: user.id,
				type: "WEEKLY_REPORT" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Weekly report: tz=${tz}, count=${notifications.length}`);
		return { sent: notifications.length };
	}
}

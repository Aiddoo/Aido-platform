import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { NotificationService } from "@/notification/notification.service";
import {
	NotificationMessageBuilder,
	resolveTemplateLocale,
} from "@/notification/templates/notification-templates";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

@Injectable()
export class MorningReminderStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(MorningReminderStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz, localHour, localMinute, userId } = ctx;
		const today = todayInTimezone(tz);
		const tomorrow = addDays(1, today);

		const selectClause = {
			id: true,
			preference: { select: { locale: true } },
			_count: {
				select: {
					todos: {
						where: { startDate: { gte: today, lt: tomorrow } },
					},
				},
			},
		} as const;

		// 프리미엄 사용자: 커스텀 시간에 리마인더 발송
		const premiumUsers = await this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					morningReminderHour: localHour,
					morningReminderMinute: localMinute,
				},
			},
			select: selectClause,
		});

		// 무료 사용자: 고정 시간(08:00)에만 리마인더 발송 (catch-up 핸들러에서는 스킵)
		const defaultHour = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE;
		const isFreeReminderTime =
			localHour === defaultHour && localMinute === defaultMinute;

		let freeUsers: typeof premiumUsers = [];
		if (!userId && isFreeReminderTime) {
			freeUsers = await this.database.user.findMany({
				where: {
					subscriptionStatus: { not: "ACTIVE" },
					role: { not: "ADMIN" },
					preference: { timezone: tz },
				},
				select: selectClause,
			});
		}

		const users = [...premiumUsers, ...freeUsers];

		if (users.length === 0) {
			return { sent: 0 };
		}

		// 중복 방지: 이미 오늘 아침 리마인더를 받은 사용자 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "MORNING_REMINDER",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		const notifications = filteredUsers.map((user) => {
			const count = user._count.todos;
			const locale = resolveTemplateLocale(user.preference?.locale);
			const message =
				count > 0
					? NotificationMessageBuilder.morningReminder(count, locale)
					: NotificationMessageBuilder.morningNoTodo(locale);

			return {
				userId: user.id,
				type: "MORNING_REMINDER" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(
			`Morning reminder: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, count=${notifications.length}`,
		);
		return { sent: notifications.length };
	}
}

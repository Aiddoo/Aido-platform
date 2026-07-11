import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	NotificationFacade,
	NotificationMessageBuilder,
	resolveTemplateLocale,
} from "@/notification";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import type { ReminderCountUser } from "../ports/scheduler-read-models";

@Injectable()
export class MorningReminderStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(MorningReminderStrategy.name);

	constructor(
		@Inject(SCHEDULED_REMINDER_READER)
		private readonly reader: ScheduledReminderReaderPort,
		private readonly notificationService: NotificationFacade,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz, localHour, localMinute, userId } = ctx;
		const today = todayInTimezone(tz);
		const tomorrow = addDays(1, today);

		// 프리미엄 사용자: 커스텀 시간에 리마인더 발송
		const premiumUsers = await this.reader.findPremiumMorningReminderUsers({
			tz,
			hour: localHour,
			minute: localMinute,
			today,
			tomorrow,
			userId,
		});

		// 무료 사용자: 고정 시간(08:00)에만 리마인더 발송 (catch-up 핸들러에서는 스킵)
		const defaultHour = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE;
		const isFreeReminderTime =
			localHour === defaultHour && localMinute === defaultMinute;

		let freeUsers: ReminderCountUser[] = [];
		if (!userId && isFreeReminderTime) {
			freeUsers = await this.reader.findFreeMorningReminderUsers({
				tz,
				today,
				tomorrow,
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

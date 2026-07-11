import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	createLocaleMessageCache,
	NotificationMessageBuilder,
	NotificationService,
} from "@/notification";
import { subtractMonths } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";

@Injectable()
export class MonthlyReportStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(MonthlyReportStrategy.name);

	constructor(
		@Inject(SCHEDULED_REMINDER_READER)
		private readonly reader: ScheduledReminderReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const monthAgo = subtractMonths(1, today);

		// 오케스트레이터가 매월 1일 10:00에만 호출 → 프리미엄 유저 대상
		const users = await this.reader.findMonthlyReportRecipients({
			tz,
			periodStart: monthAgo,
			periodEnd: today,
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

		const locales = await this.preferenceReader.findUserLocales(
			filteredUsers.map((u) => u.id),
		);
		const getMessage = createLocaleMessageCache((locale) =>
			NotificationMessageBuilder.monthlyReport(locale),
		);
		const notifications = filteredUsers.map((user) => {
			const message = getMessage(locales.get(user.id) ?? "ko");
			return {
				userId: user.id,
				type: "MONTHLY_REPORT" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Monthly report: tz=${tz}, count=${notifications.length}`);
		return { sent: notifications.length };
	}
}

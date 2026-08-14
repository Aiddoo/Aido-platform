import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificationMessageBuilder, NotificationSender } from "@/notification";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { toDateString } from "@/shared/domain/date/utils/format";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
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

/**
 * 점심 넛지 Strategy (12:30)
 *
 * 오늘 할일이 있지만 완료가 0개인 유저에게 점심 넛지를 발송합니다.
 * 고정 시간(12:30) 전용 — 프리미엄 커스텀 시간 미지원.
 */
@Injectable()
export class LunchNudgeStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(LunchNudgeStrategy.name);

	constructor(
		@Inject(SCHEDULED_REMINDER_READER)
		private readonly reader: ScheduledReminderReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationSender,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const tomorrow = addDays(1, today);

		// 오늘 할일이 있지만 완료가 0개인 유저 조회
		const users = await this.reader.findLunchNudgeUsers({
			tz,
			today,
			tomorrow,
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		// 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "LUNCH_NUDGE",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		const locales = await this.preferenceReader.findUserLocales(
			filteredUsers.map((u) => u.id),
		);
		const notifications = filteredUsers.map((user) => {
			const message = NotificationMessageBuilder.lunchNudge(
				locales.get(user.id) ?? "ko",
				{
					campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
					recipientId: user.id,
					occurrenceKey: toDateString(today),
				},
			);
			return {
				userId: user.id,
				type: "LUNCH_NUDGE" as const,
				purpose: "ENGAGEMENT" as const,
				campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
				variantId: message.variantId,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Lunch nudge: tz=${tz}, count=${notifications.length}`);
		return { sent: notifications.length };
	}
}

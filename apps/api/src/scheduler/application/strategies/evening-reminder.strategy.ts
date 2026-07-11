import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	NotificationFacade,
	NotificationMessageBuilder,
	resolveTemplateLocale,
} from "@/notification";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { computeEffectiveStreak } from "@/user-settings";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import type { UserWithTodosAndStreak } from "../ports/scheduler-read-models";

@Injectable()
export class EveningReminderStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(EveningReminderStrategy.name);

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
		const premiumUsers = await this.reader.findPremiumEveningReminderUsers({
			tz,
			hour: localHour,
			minute: localMinute,
			today,
			tomorrow,
			userId,
		});

		// 무료 사용자: 고정 시간(18:00)에만 발송
		const defaultHour = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE;
		const isFreeReminderTime =
			localHour === defaultHour && localMinute === defaultMinute;

		let freeUsers: UserWithTodosAndStreak[] = [];
		if (!userId && isFreeReminderTime) {
			freeUsers = await this.reader.findFreeEveningReminderUsers({
				tz,
				today,
				tomorrow,
			});
		}

		const users = [...premiumUsers, ...freeUsers];

		if (users.length === 0) {
			return { sent: 0 };
		}

		// 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "EVENING_REMINDER",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		const notifications = filteredUsers.map((user) => {
			const total = user.todos.length;
			const completed = user.todos.filter((t) => t.completed).length;

			// 스트릭 정보 계산 (StreakService 순수 함수에 위임)
			const { streak, isAtRisk: isStreakAtRisk } = computeEffectiveStreak({
				currentStreak: user.preference?.currentStreak ?? 0,
				lastCompletedDate: user.preference?.lastCompletedDate ?? null,
				todosCompleted: completed,
				todosTotal: total,
				today,
			});

			const message = NotificationMessageBuilder.eveningReminder(
				completed,
				total,
				streak,
				isStreakAtRisk,
				resolveTemplateLocale(user.preference?.locale),
			);

			return {
				userId: user.id,
				type: "EVENING_REMINDER" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(
			`Evening reminder: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, count=${notifications.length}`,
		);
		return { sent: notifications.length };
	}
}

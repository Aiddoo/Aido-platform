import { Injectable, Logger } from "@nestjs/common";

import { addDays } from "@/common/date/utils/arithmetic";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { StreakService } from "@/modules/user-settings/services/streak.service";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

/**
 * 스트릭 위기 Strategy (20:00)
 *
 * 스트릭 3일 이상인 유저 중 오늘 할일을 아직 다 완료하지 못한 유저에게
 * 스트릭 위기 알림을 발송합니다.
 * 고정 시간(20:00) 전용 — 야간(21:00) 시작 전 마지막 넛지.
 */
@Injectable()
export class StreakAtRiskStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(StreakAtRiskStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const tomorrow = addDays(1, today);

		// 스트릭 3일+ 유저 중 오늘 미완료 할일이 있는 유저 조회
		const users = await this.database.user.findMany({
			where: {
				preference: {
					timezone: tz,
					currentStreak: { gte: 3 },
				},
				todos: {
					some: {
						startDate: { gte: today, lt: tomorrow },
						completed: false,
					},
				},
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
				preference: {
					select: {
						currentStreak: true,
						lastCompletedDate: true,
					},
				},
			},
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		// StreakService로 isAtRisk 재검증 + streak >= 3 필터
		// effective streak 값을 보존하여 알림 메시지에 사용
		const atRiskUsers = users
			.map((user) => {
				const total = user.todos.length;
				const completed = user.todos.filter((t) => t.completed).length;

				if (completed === total) return null;

				const { streak, isAtRisk } = StreakService.computeEffectiveStreak({
					currentStreak: user.preference?.currentStreak ?? 0,
					lastCompletedDate: user.preference?.lastCompletedDate ?? null,
					todosCompleted: completed,
					todosTotal: total,
					today,
				});

				return isAtRisk && streak >= 3
					? { id: user.id, effectiveStreak: streak }
					: null;
			})
			.filter((u): u is NonNullable<typeof u> => u !== null);

		if (atRiskUsers.length === 0) {
			return { sent: 0 };
		}

		// 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: atRiskUsers.map((u) => u.id),
				type: "STREAK_AT_RISK",
				notificationDate: today,
			});

		const filteredUsers = atRiskUsers.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		const notifications = filteredUsers.map((user) => {
			const message = NotificationMessageBuilder.streakAtRisk(
				user.effectiveStreak,
			);
			return {
				userId: user.id,
				type: "STREAK_AT_RISK" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Streak at risk: tz=${tz}, count=${notifications.length}`);
		return { sent: notifications.length };
	}
}

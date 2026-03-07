import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { diffInDays } from "@/common/date/utils/compare";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import type { CreateNotificationData } from "@/modules/notification/types/notification.types";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

@Injectable()
export class WinbackStrategy {
	readonly #logger = new Logger(WinbackStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const cutoffStart = dayjs.utc(today).subtract(15, "day").toDate();
		const cutoffEnd = dayjs.utc(today).subtract(3, "day").toDate();

		// 3~15일 미접속 + pushEnabled 유저
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
				lastActiveAt: { gte: cutoffStart, lte: cutoffEnd },
			},
			select: { id: true, lastActiveAt: true },
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		// 오늘 WINBACK 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WINBACK",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		// 단계별 중복 방지: 모든 WINBACK 이력을 배치 조회
		const existingWinbacks = await this.database.notification.findMany({
			where: {
				userId: { in: filteredUsers.map((u) => u.id) },
				type: "WINBACK",
			},
			select: { userId: true, metadata: true },
		});

		const sentStageMap = new Map<string, Set<string>>();
		for (const n of existingWinbacks) {
			const stage = (n.metadata as Record<string, unknown> | null)?.stage as
				| string
				| undefined;
			if (!stage) {
				continue;
			}

			if (!sentStageMap.has(n.userId)) sentStageMap.set(n.userId, new Set());
			sentStageMap.get(n.userId)?.add(stage);
		}

		const notifications: CreateNotificationData[] = [];

		for (const user of filteredUsers) {
			if (!user.lastActiveAt) {
				continue;
			}

			const inactiveDays = diffInDays(today, user.lastActiveAt);
			let stage: string;
			if (inactiveDays >= 14) stage = "day14";
			else if (inactiveDays >= 7) stage = "day7";
			else stage = "day3";

			// 인메모리 필터링
			if (sentStageMap.get(user.id)?.has(stage)) {
				continue;
			}

			const message = NotificationMessageBuilder.winback(inactiveDays);
			notifications.push({
				userId: user.id,
				type: "WINBACK",
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { stage },
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(`Winback: tz=${tz}, count=${notifications.length}`);
		}
		return { sent: notifications.length };
	}
}

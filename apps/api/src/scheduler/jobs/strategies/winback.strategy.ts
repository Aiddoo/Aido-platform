import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CreateNotificationData } from "@/notification";
import {
	fetchUserLocales,
	NotificationMessageBuilder,
	NotificationService,
} from "@/notification";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { diffInDays } from "@/shared/domain/date/utils/compare";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { WINBACK_STAGES } from "../../constants/reminder.constants";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

@Injectable()
export class WinbackStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WinbackStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const cutoffStart = subtractDays(30, today);
		const cutoffEnd = subtractDays(3, today);

		// 3~30일 미접속 유저
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz },
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

		// 단계별 중복 방지: per-user Redis SISMEMBER 병렬 확인
		const checks = await Promise.all(
			filteredUsers.map(async (user) => {
				if (!user.lastActiveAt) return null;

				const inactiveDays = diffInDays(today, user.lastActiveAt);
				const stage = this.#getStage(inactiveDays);
				const alreadySent = await this.dedupProvider.isMember(
					DedupKeys.winbackStages(user.id),
					stage,
				);
				return { user, stage, inactiveDays, alreadySent };
			}),
		);

		const activeChecks = checks.filter(
			(check): check is NonNullable<typeof check> =>
				check !== null && check !== undefined && !check.alreadySent,
		);
		const locales = await fetchUserLocales(
			this.database,
			activeChecks.map((check) => check.user.id),
		);

		const notifications: CreateNotificationData[] = [];
		for (const check of activeChecks) {
			const message = NotificationMessageBuilder.winback(
				check.inactiveDays,
				locales.get(check.user.id) ?? "ko",
			);
			notifications.push({
				userId: check.user.id,
				type: "WINBACK",
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { stage: check.stage },
			});
		}

		// DB 성공 후 Redis 기록 (순서 보장)
		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);

			void Promise.all(
				notifications.map((n) => {
					const stage = (n.metadata as { stage: string }).stage;
					return this.dedupProvider.addMembers(
						DedupKeys.winbackStages(n.userId),
						[stage],
						DedupKeys.TTL.WINBACK_STAGES,
					);
				}),
			);

			this.#logger.log(`Winback: tz=${tz}, count=${notifications.length}`);
		}
		return { sent: notifications.length };
	}

	#getStage(inactiveDays: number): string {
		const matched = WINBACK_STAGES.find((s) => inactiveDays >= s.threshold);
		return matched?.stage ?? "day3";
	}
}

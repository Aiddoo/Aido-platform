import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CreateNotificationData } from "@/notification";
import { NotificationMessageBuilder, NotificationSender } from "@/notification";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { diffInDays } from "@/shared/domain/date/utils/compare";
import { toDateString } from "@/shared/domain/date/utils/format";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import { resolveWinbackStage } from "../../domain/services/winback-stage";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";

@Injectable()
export class WinbackStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WinbackStrategy.name);

	constructor(
		@Inject(RE_ENGAGEMENT_READER)
		private readonly reader: ReEngagementReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationSender,
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const cutoffStart = subtractDays(30, today);
		const cutoffEnd = subtractDays(3, today);

		// 3~30일 미접속 유저
		const users = await this.reader.findWinbackUsers({
			tz,
			inactiveSince: cutoffStart,
			inactiveUntil: cutoffEnd,
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
				const stage = resolveWinbackStage(inactiveDays);
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
		const locales = await this.preferenceReader.findUserLocales(
			activeChecks.map((check) => check.user.id),
		);

		const notifications: CreateNotificationData[] = [];
		for (const check of activeChecks) {
			const message = NotificationMessageBuilder.winback(
				check.inactiveDays,
				locales.get(check.user.id) ?? "ko",
				{
					campaignKey: `${SCHEDULER_CAMPAIGN_KEY.WINBACK}.${check.stage}`,
					recipientId: check.user.id,
					occurrenceKey: toDateString(today),
				},
			);
			notifications.push({
				userId: check.user.id,
				type: "WINBACK",
				purpose: "ENGAGEMENT",
				campaignKey: SCHEDULER_CAMPAIGN_KEY.WINBACK,
				variantId: message.variantId,
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
				activeChecks.map((check) =>
					this.dedupProvider.addMembers(
						DedupKeys.winbackStages(check.user.id),
						[check.stage],
						DedupKeys.TTL.WINBACK_STAGES,
					),
				),
			);

			this.#logger.log(`Winback: tz=${tz}, count=${notifications.length}`);
		}
		return { sent: notifications.length };
	}
}

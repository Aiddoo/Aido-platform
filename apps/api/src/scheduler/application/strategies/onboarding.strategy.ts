import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CreateNotificationData } from "@/notification";
import { NotificationFacade, NotificationMessageBuilder } from "@/notification";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { diffInDays } from "@/shared/domain/date/utils/compare";
import { toDateString } from "@/shared/domain/date/utils/format";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import {
	isOnboardingDay,
	ONBOARDING_MAX_DAY,
	requiresCompletedCount,
} from "../../domain/services/onboarding";
import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";

@Injectable()
export class OnboardingStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(OnboardingStrategy.name);

	constructor(
		@Inject(RE_ENGAGEMENT_READER)
		private readonly reader: ReEngagementReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationFacade,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const cutoffDate = subtractDays(ONBOARDING_MAX_DAY, today);

		// 가입 0~7일 + 해당 timezone 유저 조회
		const users = await this.reader.findOnboardingCandidates({
			tz,
			createdSince: cutoffDate,
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		// 발송 대상 day에 해당하는 유저만 필터
		const eligibleUsers = users
			.map((user) => ({
				user,
				day: diffInDays(today, user.createdAt),
			}))
			.filter(({ day }) => isOnboardingDay(day));

		if (eligibleUsers.length === 0) {
			return { sent: 0 };
		}

		// 오늘 SYSTEM_NOTICE 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: eligibleUsers.map(({ user }) => user.id),
				type: "SYSTEM_NOTICE",
				notificationDate: today,
			});

		const filteredUsers = eligibleUsers.filter(
			({ user }) => !alreadyNotified.has(user.id),
		);

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		// Day 5, 7 유저는 completedCount 조회
		const needsCountUserIds = filteredUsers
			.filter(({ day }) => requiresCompletedCount(day))
			.map(({ user }) => user.id);

		const completedCountMap = new Map<string, number>();
		if (needsCountUserIds.length > 0) {
			const counts =
				await this.reader.countCompletedTodosByUsers(needsCountUserIds);

			for (const row of counts) {
				completedCountMap.set(row.userId, row.count);
			}
		}

		// 알림 데이터 생성
		const locales = await this.preferenceReader.findUserLocales(
			filteredUsers.map(({ user }) => user.id),
		);
		const notifications: CreateNotificationData[] = [];
		for (const { user, day } of filteredUsers) {
			const completedCount = completedCountMap.get(user.id) ?? 0;
			const message = NotificationMessageBuilder.onboarding(
				day,
				completedCount,
				locales.get(user.id) ?? "ko",
				{
					campaignKey: `${SCHEDULER_CAMPAIGN_KEY.ONBOARDING}.day_${day}`,
					recipientId: user.id,
					occurrenceKey: toDateString(today),
				},
			);

			if (!message) continue;

			notifications.push({
				userId: user.id,
				type: "SYSTEM_NOTICE",
				purpose: "ENGAGEMENT",
				campaignKey: SCHEDULER_CAMPAIGN_KEY.ONBOARDING,
				variantId: message.variantId,
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { onboardingDay: day },
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(`Onboarding: tz=${tz}, count=${notifications.length}`);
		}

		return { sent: notifications.length };
	}
}

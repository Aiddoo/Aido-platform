import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CreateNotificationData } from "@/notification";
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
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";

@Injectable()
export class SocialDigestStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(SocialDigestStrategy.name);

	constructor(
		@Inject(RE_ENGAGEMENT_READER)
		private readonly reader: ReEngagementReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationSender,
	) {}

	async execute(
		ctx: TimezoneContext,
		recipientUserIds: readonly string[] = [],
	): Promise<{ sent: number }> {
		if (recipientUserIds.length === 0) {
			return { sent: 0 };
		}
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const tomorrow = addDays(1, today);

		// 해당 타임존 + 오늘 투두 미완료인 유저 조회
		const users = await this.reader.findSocialDigestCandidates({
			tz,
			today,
			tomorrow,
			recipientUserIds,
		});

		// 전체 완료한 유저 제외
		const incompleteUsers = users.filter((u) =>
			u.todos.some((t) => !t.completed),
		);

		if (incompleteUsers.length === 0) {
			return { sent: 0 };
		}

		// 중복 방지
		const [alreadyNotified, streakAtRiskNotified] = await Promise.all([
			this.notificationService.findAlreadyNotifiedUserIds({
				userIds: incompleteUsers.map((u) => u.id),
				type: "SOCIAL_DIGEST",
				notificationDate: today,
			}),
			this.notificationService.findAlreadyNotifiedUserIds({
				userIds: incompleteUsers.map((u) => u.id),
				type: "STREAK_AT_RISK",
				notificationDate: today,
			}),
		]);

		const candidates = incompleteUsers.filter(
			(u) => !alreadyNotified.has(u.id) && !streakAtRiskNotified.has(u.id),
		);

		if (candidates.length === 0) {
			return { sent: 0 };
		}

		const candidateIds = candidates.map((u) => u.id);

		// 배치 1: 모든 candidate의 맞팔 관계를 한 번에 조회
		const allFollows = await this.reader.findAcceptedFollows(candidateIds);

		// per-user 친구 ID 맵
		const friendIdMap = new Map<string, Set<string>>();
		const allFriendIds = new Set<string>();
		for (const f of allFollows) {
			for (const uid of candidateIds) {
				if (f.followerId === uid || f.followingId === uid) {
					const friendId = f.followerId === uid ? f.followingId : f.followerId;
					if (!friendIdMap.has(uid)) friendIdMap.set(uid, new Set());
					friendIdMap.get(uid)?.add(friendId);
					allFriendIds.add(friendId);
				}
			}
		}

		if (allFriendIds.size === 0) {
			return { sent: 0 };
		}

		// 배치 2: 모든 친구의 오늘 투두 완료 현황을 한 번에 조회
		const friendsWithTodos = await this.reader.findFriendsWithTodayTodos({
			friendIds: [...allFriendIds],
			today,
			tomorrow,
		});

		// 전체 완료한 친구만 필터링 (이름 미설정은 수신자 로케일별 폴백으로 치환)
		const completedFriendMap = new Map<string, { name: string | null }>();
		for (const f of friendsWithTodos) {
			if (f.todos.length > 0 && f.todos.every((t) => t.completed)) {
				completedFriendMap.set(f.id, {
					name: f.profile?.name ?? null,
				});
			}
		}

		const locales = await this.preferenceReader.findUserLocales(
			candidates.map((u) => u.id),
		);

		// 인메모리 매칭
		const notifications: CreateNotificationData[] = [];

		for (const user of candidates) {
			const userFriendIds = friendIdMap.get(user.id);

			if (!userFriendIds || userFriendIds.size === 0) {
				continue;
			}

			const completedFriends = [...userFriendIds]
				.map((id) => completedFriendMap.get(id))
				.filter((f): f is { name: string | null } => f !== undefined);

			if (completedFriends.length === 0) {
				continue;
			}

			const locale = locales.get(user.id) ?? "ko";
			const fallbackName = locale === "en" ? "Your friend" : "친구";
			const friendName =
				completedFriends.length === 1
					? (completedFriends[0]?.name ?? fallbackName)
					: undefined;

			const message = NotificationMessageBuilder.socialDigest(
				completedFriends.length,
				friendName,
				locale,
				{
					campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
					recipientId: user.id,
					occurrenceKey: toDateString(today),
				},
			);

			notifications.push({
				userId: user.id,
				type: "SOCIAL_DIGEST",
				purpose: "ENGAGEMENT",
				campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
				variantId: message.variantId,
				title: message.title,
				body: message.body,
				notificationDate: today,
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(
				`Social digest: tz=${tz}, count=${notifications.length}`,
			);
		}
		return { sent: notifications.length };
	}
}

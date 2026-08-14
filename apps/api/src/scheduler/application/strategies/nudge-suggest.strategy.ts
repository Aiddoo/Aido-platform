import { Inject, Injectable, Logger } from "@nestjs/common";

import type { CreateNotificationData } from "@/notification";
import { NotificationMessageBuilder, NotificationSender } from "@/notification";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { diffInDays } from "@/shared/domain/date/utils/compare";
import { toDateString, toIsoWeekId } from "@/shared/domain/date/utils/format";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import type { ITimezoneStrategy, TimezoneContext } from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import { SCHEDULER_DEDUP, type SchedulerDedupPort } from "../ports/scheduler-dedup.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";

@Injectable()
export class NudgeSuggestStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(NudgeSuggestStrategy.name);

	constructor(
		@Inject(RE_ENGAGEMENT_READER)
		private readonly reader: ReEngagementReaderPort,
		@Inject(SCHEDULER_PREFERENCE_READER)
		private readonly preferenceReader: SchedulerPreferenceReaderPort,
		private readonly notificationService: NotificationSender,
		@Inject(SCHEDULER_DEDUP)
		private readonly schedulerDedup: SchedulerDedupPort,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const weekAgo = subtractDays(7, today);
		const twoDaysAgo = subtractDays(2, today);

		// 이 타임존의 활성 유저 목록
		const activeUsers = await this.reader.findActiveUsersInTimezone(tz);

		if (activeUsers.length === 0) {
			return { sent: 0 };
		}

		// 이미 오늘 NUDGE_SUGGEST 받은 유저 제외
		const alreadyNotified = await this.notificationService.findAlreadyNotifiedUserIds({
			userIds: activeUsers.map((u) => u.id),
			type: "NUDGE_SUGGEST",
			notificationDate: today,
		});

		const candidates = activeUsers.filter((u) => !alreadyNotified.has(u.id));

		if (candidates.length === 0) {
			return { sent: 0 };
		}

		const candidateIds = candidates.map((u) => u.id);
		const candidateSet = new Set(candidateIds);

		// 배치 1: 모든 candidate의 비활성 맞팔 친구를 한 번에 조회
		const allFollows = await this.reader.findNudgeSuggestFollows({
			candidateIds,
			activeSince: weekAgo,
			activeUntil: twoDaysAgo,
		});

		// per-user 친구 맵 생성
		const friendMap = new Map<
			string,
			Array<{ id: string; name: string | null; lastActiveAt: Date | null }>
		>();
		for (const f of allFollows) {
			const userIds = [f.followerId, f.followingId].filter((id) => candidateSet.has(id));
			for (const uid of userIds) {
				const friend = f.followerId === uid ? f.following : f.follower;
				if (!friendMap.has(uid)) friendMap.set(uid, []);
				friendMap.get(uid)?.push({
					id: friend.id,
					name: friend.profile?.name ?? null,
					lastActiveAt: friend.lastActiveAt,
				});
			}
		}

		// 배치 2: 이번 주 발송 이력을 compound key로 단일 Redis 조회
		const weekId = toIsoWeekId(today);
		// 전체 candidate × friend 조합을 한 번에 빌드
		const allPairs: string[] = [];
		for (const user of candidates) {
			const friends = friendMap.get(user.id) ?? [];
			const pairs = friends.map((f) => `${user.id}:${f.id}`);
			allPairs.push(...pairs);
		}

		// 단일 SMISMEMBER — O(allPairs.length)
		const sentPairs = await this.schedulerDedup.findSentNudgePairs(weekId, allPairs);

		const locales = await this.preferenceReader.findUserLocales(candidates.map((u) => u.id));

		// 인메모리 매칭
		const notifications: CreateNotificationData[] = [];

		for (const user of candidates) {
			const friends = friendMap.get(user.id);

			if (!friends || friends.length === 0) {
				continue;
			}

			const eligibleFriends = friends
				.filter((f) => !sentPairs.has(`${user.id}:${f.id}`))
				.sort((a, b) => {
					const daysA = a.lastActiveAt ? diffInDays(today, a.lastActiveAt) : 0;
					const daysB = b.lastActiveAt ? diffInDays(today, b.lastActiveAt) : 0;
					return daysB - daysA;
				});

			const target = eligibleFriends[0];

			if (!target?.lastActiveAt) {
				continue;
			}

			const days = diffInDays(today, target.lastActiveAt);
			const locale = locales.get(user.id) ?? "ko";
			const message = NotificationMessageBuilder.nudgeSuggest(
				target.name ?? (locale === "en" ? "Your friend" : "친구"),
				days,
				locale,
				{
					campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
					recipientId: user.id,
					occurrenceKey: toDateString(today),
				},
			);

			notifications.push({
				userId: user.id,
				type: "NUDGE_SUGGEST",
				purpose: "ENGAGEMENT",
				campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
				variantId: message.variantId,
				title: message.title,
				body: message.body,
				friendId: target.id,
				notificationDate: today,
			});
		}

		// DB 성공 후 Redis 기록 (순서 보장)
		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);

			const members = notifications.map((n) => `${n.userId}:${n.friendId}`);
			void this.schedulerDedup.recordNudgePairs(weekId, members);

			this.#logger.log(`Nudge suggest: tz=${tz}, count=${notifications.length}`);
		}
		return { sent: notifications.length };
	}
}

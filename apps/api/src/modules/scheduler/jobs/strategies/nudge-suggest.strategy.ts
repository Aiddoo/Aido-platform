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
export class NudgeSuggestStrategy {
	readonly #logger = new Logger(NudgeSuggestStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const weekAgo = dayjs.utc(today).subtract(7, "day").toDate();
		const twoDaysAgo = dayjs.utc(today).subtract(2, "day").toDate();

		// 이 타임존에서 pushEnabled인 유저 목록
		const activeUsers = await this.database.user.findMany({
			where: {
				deletedAt: null,
				preference: { timezone: tz, pushEnabled: true },
			},
			select: { id: true },
		});

		if (activeUsers.length === 0) {
			return { sent: 0 };
		}

		// 이미 오늘 NUDGE_SUGGEST 받은 유저 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: activeUsers.map((u) => u.id),
				type: "NUDGE_SUGGEST",
				notificationDate: today,
			});

		const candidates = activeUsers.filter((u) => !alreadyNotified.has(u.id));

		if (candidates.length === 0) {
			return { sent: 0 };
		}

		const candidateIds = candidates.map((u) => u.id);

		// 배치 1: 모든 candidate의 비활성 맞팔 친구를 한 번에 조회
		const allFollows = await this.database.follow.findMany({
			where: {
				OR: [
					{
						followerId: { in: candidateIds },
						status: "ACCEPTED",
						following: {
							lastActiveAt: { gte: weekAgo, lte: twoDaysAgo },
						},
					},
					{
						followingId: { in: candidateIds },
						status: "ACCEPTED",
						follower: {
							lastActiveAt: { gte: weekAgo, lte: twoDaysAgo },
						},
					},
				],
			},
			select: {
				followerId: true,
				followingId: true,
				follower: {
					select: {
						id: true,
						lastActiveAt: true,
						profile: { select: { name: true } },
					},
				},
				following: {
					select: {
						id: true,
						lastActiveAt: true,
						profile: { select: { name: true } },
					},
				},
			},
		});

		// per-user 친구 맵 생성
		const friendMap = new Map<
			string,
			Array<{ id: string; name: string; lastActiveAt: Date | null }>
		>();
		for (const f of allFollows) {
			const userIds = [f.followerId, f.followingId].filter((id) =>
				candidateIds.includes(id),
			);
			for (const uid of userIds) {
				const friend = f.followerId === uid ? f.following : f.follower;
				if (!friendMap.has(uid)) friendMap.set(uid, []);
				friendMap.get(uid)?.push({
					id: friend.id,
					name: friend.profile?.name ?? "친구",
					lastActiveAt: friend.lastActiveAt,
				});
			}
		}

		// 배치 2: 이번 주 NUDGE_SUGGEST 발송 이력을 한 번에 조회
		const thisWeekNotifications = await this.database.notification.findMany({
			where: {
				userId: { in: candidateIds },
				type: "NUDGE_SUGGEST",
				notificationDate: { gte: weekAgo },
			},
			select: { userId: true, metadata: true },
		});

		const sentFriendMap = new Map<string, Set<string>>();
		for (const n of thisWeekNotifications) {
			const friendId = (n.metadata as Record<string, unknown> | null)
				?.friendId as string | undefined;
			if (!friendId) {
				continue;
			}

			if (!sentFriendMap.has(n.userId)) sentFriendMap.set(n.userId, new Set());
			sentFriendMap.get(n.userId)?.add(friendId);
		}

		// 인메모리 매칭
		const notifications: CreateNotificationData[] = [];

		for (const user of candidates) {
			const friends = friendMap.get(user.id);

			if (!friends || friends.length === 0) {
				continue;
			}

			const sentIds = sentFriendMap.get(user.id) ?? new Set<string>();

			const eligibleFriends = friends
				.filter((f) => !sentIds.has(f.id))
				.sort((a, b) => {
					const daysA = a.lastActiveAt ? diffInDays(today, a.lastActiveAt) : 0;
					const daysB = b.lastActiveAt ? diffInDays(today, b.lastActiveAt) : 0;
					return daysB - daysA;
				});

			const target = eligibleFriends[0];

			if (!target || !target.lastActiveAt) {
				continue;
			}

			const days = diffInDays(today, target.lastActiveAt);
			const message = NotificationMessageBuilder.nudgeSuggest(
				target.name,
				days,
			);

			notifications.push({
				userId: user.id,
				type: "NUDGE_SUGGEST",
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { friendId: target.id },
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(
				`Nudge suggest: tz=${tz}, count=${notifications.length}`,
			);
		}
		return { sent: notifications.length };
	}
}

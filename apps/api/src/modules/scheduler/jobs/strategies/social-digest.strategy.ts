import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import type { CreateNotificationData } from "@/modules/notification/types/notification.types";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

@Injectable()
export class SocialDigestStrategy {
	readonly #logger = new Logger(SocialDigestStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		// pushEnabled + 해당 타임존 + 오늘 투두 미완료인 유저 조회
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
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
			},
		});

		// 전체 완료한 유저 제외
		const incompleteUsers = users.filter((u) =>
			u.todos.some((t) => !t.completed),
		);

		if (incompleteUsers.length === 0) {
			return { sent: 0 };
		}

		// 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: incompleteUsers.map((u) => u.id),
				type: "SOCIAL_DIGEST",
				notificationDate: today,
			});

		const candidates = incompleteUsers.filter(
			(u) => !alreadyNotified.has(u.id),
		);

		if (candidates.length === 0) {
			return { sent: 0 };
		}

		const candidateIds = candidates.map((u) => u.id);

		// 배치 1: 모든 candidate의 맞팔 관계를 한 번에 조회
		const allFollows = await this.database.follow.findMany({
			where: {
				OR: [
					{ followerId: { in: candidateIds }, status: "ACCEPTED" },
					{ followingId: { in: candidateIds }, status: "ACCEPTED" },
				],
			},
			select: { followerId: true, followingId: true },
		});

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
		const friendsWithTodos = await this.database.user.findMany({
			where: {
				id: { in: [...allFriendIds] },
				todos: {
					some: { startDate: { gte: today, lt: tomorrow } },
				},
			},
			select: {
				id: true,
				profile: { select: { name: true } },
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
			},
		});

		// 전체 완료한 친구만 필터링
		const completedFriendMap = new Map<string, { name: string }>();
		for (const f of friendsWithTodos) {
			if (f.todos.length > 0 && f.todos.every((t) => t.completed)) {
				completedFriendMap.set(f.id, {
					name: f.profile?.name ?? "친구",
				});
			}
		}

		// 인메모리 매칭
		const notifications: CreateNotificationData[] = [];

		for (const user of candidates) {
			const userFriendIds = friendIdMap.get(user.id);

			if (!userFriendIds || userFriendIds.size === 0) {
				continue;
			}

			const completedFriends = [...userFriendIds]
				.map((id) => completedFriendMap.get(id))
				.filter((f): f is { name: string } => f !== undefined);

			if (completedFriends.length === 0) {
				continue;
			}

			const friendName =
				completedFriends.length === 1 ? completedFriends[0]?.name : undefined;

			const message = NotificationMessageBuilder.socialDigest(
				completedFriends.length,
				friendName,
			);

			notifications.push({
				userId: user.id,
				type: "SOCIAL_DIGEST",
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

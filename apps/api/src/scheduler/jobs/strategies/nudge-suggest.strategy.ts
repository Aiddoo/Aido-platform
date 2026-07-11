import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CreateNotificationData } from "@/notification";
import {
	fetchUserLocales,
	NotificationMessageBuilder,
	NotificationService,
} from "@/notification";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { diffInDays } from "@/shared/domain/date/utils/compare";
import { toIsoWeekId } from "@/shared/domain/date/utils/format";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

@Injectable()
export class NudgeSuggestStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(NudgeSuggestStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		@Inject(DEDUP_PROVIDER)
		private readonly dedupProvider: IDedupProvider,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const weekAgo = subtractDays(7, today);
		const twoDaysAgo = subtractDays(2, today);

		// 이 타임존의 활성 유저 목록
		const activeUsers = await this.database.user.findMany({
			where: {
				deletedAt: null,
				preference: { timezone: tz },
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
		const candidateSet = new Set(candidateIds);

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
			Array<{ id: string; name: string | null; lastActiveAt: Date | null }>
		>();
		for (const f of allFollows) {
			const userIds = [f.followerId, f.followingId].filter((id) =>
				candidateSet.has(id),
			);
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
		const setKey = DedupKeys.nudgeSuggestSent(weekId);

		// 전체 candidate × friend 조합을 한 번에 빌드
		const allPairs: string[] = [];
		for (const user of candidates) {
			const friends = friendMap.get(user.id) ?? [];
			const pairs = friends.map((f) => `${user.id}:${f.id}`);
			allPairs.push(...pairs);
		}

		// 단일 SMISMEMBER — O(allPairs.length)
		const sentPairs = await this.dedupProvider.filterMembers(setKey, allPairs);

		const locales = await fetchUserLocales(
			this.database,
			candidates.map((u) => u.id),
		);

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
			);

			notifications.push({
				userId: user.id,
				type: "NUDGE_SUGGEST",
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
			void this.dedupProvider.addMembers(
				setKey,
				members,
				DedupKeys.TTL.NUDGE_SUGGEST,
			);

			this.#logger.log(
				`Nudge suggest: tz=${tz}, count=${notifications.length}`,
			);
		}
		return { sent: notifications.length };
	}
}

/**
 * Friend 테스트 Fixture
 *
 * 타입 안전한 Follow, Nudge, Cheer 엔티티 테스트 데이터 생성
 */
import type { Cheer, Follow, Nudge } from "@/generated/prisma/client";

let followCounter = 0;
let nudgeCounter = 0;
let cheerCounter = 0;

/**
 * Follow Fixture 팩토리
 *
 * @example
 * ```typescript
 * // 팔로우 관계 생성
 * const follow = FollowFixture.create({
 *   followerId: 'user-1',
 *   followingId: 'user-2',
 * });
 *
 * // 수락된 팔로우 생성
 * const accepted = FollowFixture.createAccepted({
 *   followerId: 'user-1',
 *   followingId: 'user-2',
 * });
 * ```
 */
export const FollowFixture = {
	/**
	 * Follow 엔티티 생성 (PENDING 상태)
	 */
	create: (overrides: Partial<Follow> = {}): Follow => {
		const id = ++followCounter;
		const now = new Date();

		return {
			id: overrides.id ?? `follow-${id}`,
			followerId: overrides.followerId ?? `follower-${id}`,
			followingId: overrides.followingId ?? `following-${id}`,
			status: overrides.status ?? "PENDING",
			sortOrder: overrides.sortOrder ?? 0,
			createdAt: overrides.createdAt ?? now,
			updatedAt: overrides.updatedAt ?? now,
		};
	},

	/**
	 * 수락된 Follow 생성
	 */
	createAccepted: (overrides: Partial<Follow> = {}): Follow => {
		return FollowFixture.create({
			status: "ACCEPTED",
			...overrides,
		});
	},

	/**
	 * 상호 팔로우 관계 생성
	 */
	createMutual: (userId1: string, userId2: string): { follow1: Follow; follow2: Follow } => {
		const follow1 = FollowFixture.createAccepted({
			followerId: userId1,
			followingId: userId2,
		});
		const follow2 = FollowFixture.createAccepted({
			followerId: userId2,
			followingId: userId1,
		});

		return { follow1, follow2 };
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		followCounter = 0;
	},
};

/**
 * Nudge Fixture 팩토리
 */
export const NudgeFixture = {
	/**
	 * Nudge 엔티티 생성
	 */
	create: (overrides: Partial<Nudge> = {}): Nudge => {
		const id = ++nudgeCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			senderId: overrides.senderId ?? `sender-${id}`,
			receiverId: overrides.receiverId ?? `receiver-${id}`,
			todoId: overrides.todoId ?? id,
			message: overrides.message ?? null,
			readAt: overrides.readAt ?? null,
			createdAt: overrides.createdAt ?? now,
		};
	},

	/**
	 * 읽은 Nudge 생성
	 */
	createRead: (overrides: Partial<Nudge> = {}): Nudge => {
		return NudgeFixture.create({
			readAt: new Date(),
			...overrides,
		});
	},

	/**
	 * 메시지가 있는 Nudge 생성
	 */
	createWithMessage: (message: string, overrides: Partial<Nudge> = {}): Nudge => {
		return NudgeFixture.create({
			message,
			...overrides,
		});
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		nudgeCounter = 0;
	},
};

/**
 * Cheer Fixture 팩토리
 */
export const CheerFixture = {
	/**
	 * Cheer 엔티티 생성
	 */
	create: (overrides: Partial<Cheer> = {}): Cheer => {
		const id = ++cheerCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			senderId: overrides.senderId ?? `sender-${id}`,
			receiverId: overrides.receiverId ?? `receiver-${id}`,
			message: overrides.message ?? null,
			readAt: overrides.readAt ?? null,
			createdAt: overrides.createdAt ?? now,
		};
	},

	/**
	 * 읽은 Cheer 생성
	 */
	createRead: (overrides: Partial<Cheer> = {}): Cheer => {
		return CheerFixture.create({
			readAt: new Date(),
			...overrides,
		});
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		cheerCounter = 0;
	},
};

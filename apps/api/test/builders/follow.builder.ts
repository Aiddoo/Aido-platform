/**
 * Follow 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 팔로우 (PENDING)
 * const follow = FollowBuilder.create('follower-123', 'following-456').build();
 *
 * // 수락된 팔로우
 * const accepted = FollowBuilder.create('follower-123', 'following-456')
 *   .accepted()
 *   .build();
 *
 * // 사용자 정보 포함
 * const withUser = FollowBuilder.create('follower-123', 'following-456')
 *   .withFollowerUser({ id: 'follower-123', userTag: 'ABC12DEF', profile: null })
 *   .buildWithUser();
 * ```
 */
import type { Follow, FollowStatus } from "@/generated/prisma/client";

/**
 * 팔로워/팔로잉 사용자 정보 (목록 조회용)
 */
export interface FollowUserInfo {
	id: string;
	userTag: string;
	profile: {
		name: string | null;
		profileImage: string | null;
	} | null;
}

/**
 * 팔로워 정보 포함 Follow
 */
export interface FollowWithFollower extends Follow {
	follower: FollowUserInfo;
}

/**
 * 팔로잉 정보 포함 Follow
 */
export interface FollowWithFollowing extends Follow {
	following: FollowUserInfo;
}

/**
 * 팔로워/팔로잉 정보 모두 포함 Follow
 */
export interface FollowWithUser extends Follow {
	follower: FollowUserInfo;
	following: FollowUserInfo;
}

export class FollowBuilder {
	private data: Follow;
	private followerUser: FollowUserInfo | null = null;
	private followingUser: FollowUserInfo | null = null;

	private constructor(followerId: string, followingId: string) {
		const now = new Date();
		this.data = {
			id: `follow-${crypto.randomUUID().slice(0, 8)}`,
			followerId,
			followingId,
			status: "PENDING" as FollowStatus,
			createdAt: now,
			updatedAt: now,
		};
	}

	static create(followerId: string, followingId: string): FollowBuilder {
		return new FollowBuilder(followerId, followingId);
	}

	// === ID 관련 ===

	withId(id: string): FollowBuilder {
		this.data.id = id;
		return this;
	}

	// === 상태 관련 ===

	withStatus(status: FollowStatus): FollowBuilder {
		this.data.status = status;
		return this;
	}

	/** PENDING 상태 (기본값) */
	pending(): FollowBuilder {
		this.data.status = "PENDING";
		return this;
	}

	/** ACCEPTED 상태 (친구 관계 성립) */
	accepted(): FollowBuilder {
		this.data.status = "ACCEPTED";
		return this;
	}

	// === 관계 사용자 정보 ===

	withFollowerUser(user: FollowUserInfo): FollowBuilder {
		this.followerUser = user;
		return this;
	}

	withFollowingUser(user: FollowUserInfo): FollowBuilder {
		this.followingUser = user;
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): FollowBuilder {
		this.data.createdAt = date;
		return this;
	}

	withUpdatedAt(date: Date): FollowBuilder {
		this.data.updatedAt = date;
		return this;
	}

	// === 빌드 ===

	build(): Follow {
		return { ...this.data };
	}

	/** 팔로워 정보 포함 빌드 */
	buildWithFollower(): FollowWithFollower {
		return {
			...this.data,
			follower: this.followerUser ?? {
				id: this.data.followerId,
				userTag: "TESTUSER",
				profile: null,
			},
		};
	}

	/** 팔로잉 정보 포함 빌드 */
	buildWithFollowing(): FollowWithFollowing {
		return {
			...this.data,
			following: this.followingUser ?? {
				id: this.data.followingId,
				userTag: "TESTUSER",
				profile: null,
			},
		};
	}

	/** 팔로워/팔로잉 정보 모두 포함 빌드 */
	buildWithUser(): FollowWithUser {
		return {
			...this.data,
			follower: this.followerUser ?? {
				id: this.data.followerId,
				userTag: "FOLLOWER",
				profile: null,
			},
			following: this.followingUser ?? {
				id: this.data.followingId,
				userTag: "FOLLOWING",
				profile: null,
			},
		};
	}

	/** 여러 개 생성 */
	static createMany(followerId: string, followingIds: string[]): Follow[] {
		return followingIds.map((followingId) =>
			FollowBuilder.create(followerId, followingId).build(),
		);
	}
}

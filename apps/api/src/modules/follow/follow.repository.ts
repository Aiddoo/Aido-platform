import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import { type Follow, type Prisma } from "@/generated/prisma/client";

import type {
	FindFollowsParams,
	FollowWithUser,
	TransactionClient,
} from "./types/follow.types";

// =============================================================================
// Repository
// =============================================================================

@Injectable()
export class FollowRepository {
	constructor(private readonly database: DatabaseService) {}

	// Include 설정 (프로필 정보 포함)
	private readonly userSelect = {
		id: true,
		userTag: true,
		profile: {
			select: {
				name: true,
				profileImage: true,
			},
		},
	} as const;

	// =========================================================================
	// 기본 CRUD
	// =========================================================================

	/**
	 * 팔로우 관계 생성
	 */
	async create(
		data: Prisma.FollowCreateInput,
		tx?: TransactionClient,
	): Promise<Follow> {
		const client = tx ?? this.database;
		return client.follow.create({ data });
	}

	/**
	 * 팔로우 관계 조회 (followerId + followingId)
	 */
	async findByFollowerAndFollowing(
		followerId: string,
		followingId: string,
		tx?: TransactionClient,
	): Promise<Follow | null> {
		const client = tx ?? this.database;
		return client.follow.findUnique({
			where: {
				followerId_followingId: {
					followerId,
					followingId,
				},
			},
		});
	}

	/**
	 * ID로 팔로우 관계 조회
	 */
	async findById(id: string, tx?: TransactionClient): Promise<Follow | null> {
		const client = tx ?? this.database;
		return client.follow.findUnique({
			where: { id },
		});
	}

	/**
	 * ID로 팔로우 관계 조회 (사용자 정보 포함)
	 */
	async findByIdWithUser(
		id: string,
		tx?: TransactionClient,
	): Promise<FollowWithUser | null> {
		const client = tx ?? this.database;
		return client.follow.findUnique({
			where: { id },
			include: {
				follower: {
					select: this.userSelect,
				},
				following: {
					select: this.userSelect,
				},
			},
		});
	}

	/**
	 * 팔로우 관계 수정
	 */
	async update(
		id: string,
		data: Prisma.FollowUpdateInput,
		tx?: TransactionClient,
	): Promise<Follow> {
		const client = tx ?? this.database;
		return client.follow.update({
			where: { id },
			data,
		});
	}

	/**
	 * followerId + followingId로 팔로우 관계 수정
	 */
	async updateByFollowerAndFollowing(
		followerId: string,
		followingId: string,
		data: Prisma.FollowUpdateInput,
		tx?: TransactionClient,
	): Promise<Follow> {
		const client = tx ?? this.database;
		return client.follow.update({
			where: {
				followerId_followingId: {
					followerId,
					followingId,
				},
			},
			data,
		});
	}

	/**
	 * 팔로우 관계 삭제
	 */
	async delete(id: string, tx?: TransactionClient): Promise<Follow> {
		const client = tx ?? this.database;
		return client.follow.delete({
			where: { id },
		});
	}

	/**
	 * followerId + followingId로 팔로우 관계 삭제
	 */
	async deleteByFollowerAndFollowing(
		followerId: string,
		followingId: string,
		tx?: TransactionClient,
	): Promise<Follow> {
		const client = tx ?? this.database;
		return client.follow.delete({
			where: {
				followerId_followingId: {
					followerId,
					followingId,
				},
			},
		});
	}

	// =========================================================================
	// 친구 목록 조회 (맞팔 관계)
	// =========================================================================

	/**
	 * 맞팔 친구 목록 조회
	 * 내가 팔로우하고(ACCEPTED), 상대방도 나를 팔로우(ACCEPTED)한 관계
	 */
	async findMutualFriends(
		params: FindFollowsParams,
	): Promise<FollowWithUser[]> {
		const { userId, cursor, size, search } = params;

		// userTag 검색 조건 (userTag로만 검색)
		const searchCondition = search
			? { userTag: { contains: search, mode: "insensitive" as const } }
			: {};

		// 내가 팔로우하고, 상대방도 나를 팔로우한 관계 (양방향 ACCEPTED)
		return this.database.follow.findMany({
			where: {
				followerId: userId,
				status: "ACCEPTED",
				// 상대방도 나를 팔로우하고 있는지 서브쿼리
				following: {
					...searchCondition,
					following: {
						some: {
							followerId: { not: userId }, // 상대방이
							followingId: userId, // 나를 팔로우
							status: "ACCEPTED",
						},
					},
				},
			},
			include: {
				follower: {
					select: this.userSelect,
				},
				following: {
					select: this.userSelect,
				},
			},
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 맞팔 여부 확인
	 */
	async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		const [myFollow, theirFollow] = await Promise.all([
			this.database.follow.findFirst({
				where: {
					followerId: userId,
					followingId: targetUserId,
					status: "ACCEPTED",
				},
			}),
			this.database.follow.findFirst({
				where: {
					followerId: targetUserId,
					followingId: userId,
					status: "ACCEPTED",
				},
			}),
		]);

		return myFollow !== null && theirFollow !== null;
	}

	// =========================================================================
	// 친구 요청 목록 조회
	// =========================================================================

	/**
	 * 받은 친구 요청 목록 (PENDING 상태)
	 */
	async findReceivedRequests(
		params: FindFollowsParams,
	): Promise<FollowWithUser[]> {
		const { userId, cursor, size } = params;

		return this.database.follow.findMany({
			where: {
				followingId: userId,
				status: "PENDING",
			},
			include: {
				follower: {
					select: this.userSelect,
				},
				following: {
					select: this.userSelect,
				},
			},
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 보낸 친구 요청 목록 (PENDING 상태)
	 */
	async findSentRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
		const { userId, cursor, size } = params;

		return this.database.follow.findMany({
			where: {
				followerId: userId,
				status: "PENDING",
			},
			include: {
				follower: {
					select: this.userSelect,
				},
				following: {
					select: this.userSelect,
				},
			},
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
		});
	}

	// =========================================================================
	// 카운트 조회
	// =========================================================================

	/**
	 * 친구 수 (맞팔)
	 */
	async countMutualFriends(userId: string): Promise<number> {
		// 내가 팔로우하고, 상대방도 나를 팔로우한 관계 수
		return this.database.follow.count({
			where: {
				followerId: userId,
				status: "ACCEPTED",
				following: {
					following: {
						some: {
							followingId: userId,
							status: "ACCEPTED",
						},
					},
				},
			},
		});
	}

	/**
	 * 받은 친구 요청 수
	 */
	async countReceivedRequests(userId: string): Promise<number> {
		return this.database.follow.count({
			where: {
				followingId: userId,
				status: "PENDING",
			},
		});
	}

	/**
	 * 보낸 친구 요청 수
	 */
	async countSentRequests(userId: string): Promise<number> {
		return this.database.follow.count({
			where: {
				followerId: userId,
				status: "PENDING",
			},
		});
	}

	// =========================================================================
	// 사용자 존재 확인 (외부 의존성)
	// =========================================================================

	/**
	 * 사용자 존재 확인
	 */
	async userExists(userId: string): Promise<boolean> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		return user !== null;
	}

	/**
	 * 사용자 이름 조회 (알림용)
	 */
	async getUserName(userId: string): Promise<string | null> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: {
				profile: {
					select: { name: true },
				},
			},
		});
		return user?.profile?.name ?? null;
	}
}

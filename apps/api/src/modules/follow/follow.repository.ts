import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { USER_BRIEF_SELECT } from "@/common/database/selects";
import type { DatabaseService } from "@/database/database.service";
import { type Follow, type Prisma } from "@/generated/prisma/client";

import type { FindFollowsParams, FollowWithUser } from "./types/follow.types";

@Injectable()
export class FollowRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * 팔로우 관계 생성
	 */
	async create(data: Prisma.FollowCreateInput): Promise<Follow> {
		return this.client.follow.create({ data });
	}

	/**
	 * 팔로우 관계 조회 (followerId + followingId)
	 */
	async findByFollowerAndFollowing(
		followerId: string,
		followingId: string,
	): Promise<Follow | null> {
		return this.client.follow.findUnique({
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
	async findById(id: string): Promise<Follow | null> {
		return this.client.follow.findUnique({
			where: { id },
		});
	}

	/**
	 * ID로 팔로우 관계 조회 (사용자 정보 포함)
	 */
	async findByIdWithUser(id: string): Promise<FollowWithUser | null> {
		return this.client.follow.findUnique({
			where: { id },
			include: {
				follower: {
					select: USER_BRIEF_SELECT,
				},
				following: {
					select: USER_BRIEF_SELECT,
				},
			},
		});
	}

	/**
	 * 팔로우 관계 수정
	 */
	async update(id: string, data: Prisma.FollowUpdateInput): Promise<Follow> {
		return this.client.follow.update({
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
	): Promise<Follow> {
		return this.client.follow.update({
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
	async delete(id: string): Promise<Follow> {
		return this.client.follow.delete({
			where: { id },
		});
	}

	/**
	 * followerId + followingId로 팔로우 관계 삭제
	 */
	async deleteByFollowerAndFollowing(
		followerId: string,
		followingId: string,
	): Promise<Follow> {
		return this.client.follow.delete({
			where: {
				followerId_followingId: {
					followerId,
					followingId,
				},
			},
		});
	}

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
		return this.client.follow.findMany({
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
					select: USER_BRIEF_SELECT,
				},
				following: {
					select: USER_BRIEF_SELECT,
				},
			},
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
		});
	}

	/**
	 * Follow ID + followerId 소유권 확인 (ACCEPTED 상태)
	 */
	async findAcceptedByIdAndFollowerId(
		id: string,
		followerId: string,
	): Promise<Follow | null> {
		return this.client.follow.findFirst({
			where: { id, followerId, status: "ACCEPTED" },
		});
	}

	/**
	 * 사용자의 ACCEPTED 팔로우 중 최대 sortOrder
	 */
	async getMaxSortOrderForFriends(followerId: string): Promise<number> {
		const result = await this.client.follow.aggregate({
			where: { followerId, status: "ACCEPTED" },
			_max: { sortOrder: true },
		});
		return result._max.sortOrder ?? -1;
	}

	/**
	 * 범위 내 sortOrder 일괄 조정 (atomic updateMany)
	 */
	async shiftFriendSortOrders(
		followerId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
	): Promise<number> {
		const result = await this.client.follow.updateMany({
			where: {
				followerId,
				status: "ACCEPTED",
				sortOrder: {
					gte: fromSortOrder,
					...(toSortOrder !== null && { lte: toSortOrder }),
				},
			},
			data: { sortOrder: { increment: delta } },
		});
		return result.count;
	}

	/**
	 * 단일 Follow sortOrder 업데이트 (User include)
	 */
	async updateFollowSortOrder(
		id: string,
		sortOrder: number,
	): Promise<FollowWithUser> {
		return this.client.follow.update({
			where: { id },
			data: { sortOrder },
			include: {
				follower: { select: USER_BRIEF_SELECT },
				following: { select: USER_BRIEF_SELECT },
			},
		}) as Promise<FollowWithUser>;
	}

	/**
	 * 맞팔 여부 확인
	 */
	async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		const [myFollow, theirFollow] = await Promise.all([
			this.client.follow.findFirst({
				where: {
					followerId: userId,
					followingId: targetUserId,
					status: "ACCEPTED",
				},
			}),
			this.client.follow.findFirst({
				where: {
					followerId: targetUserId,
					followingId: userId,
					status: "ACCEPTED",
				},
			}),
		]);

		return myFollow !== null && theirFollow !== null;
	}

	/**
	 * 받은 친구 요청 목록 (PENDING 상태)
	 */
	async findReceivedRequests(
		params: FindFollowsParams,
	): Promise<FollowWithUser[]> {
		const { userId, cursor, size } = params;

		return this.client.follow.findMany({
			where: {
				followingId: userId,
				status: "PENDING",
			},
			include: {
				follower: {
					select: USER_BRIEF_SELECT,
				},
				following: {
					select: USER_BRIEF_SELECT,
				},
			},
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	/**
	 * 보낸 친구 요청 목록 (PENDING 상태)
	 */
	async findSentRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
		const { userId, cursor, size } = params;

		return this.client.follow.findMany({
			where: {
				followerId: userId,
				status: "PENDING",
			},
			include: {
				follower: {
					select: USER_BRIEF_SELECT,
				},
				following: {
					select: USER_BRIEF_SELECT,
				},
			},
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	/**
	 * 친구 수 (맞팔)
	 */
	async countMutualFriends(userId: string): Promise<number> {
		// 내가 팔로우하고, 상대방도 나를 팔로우한 관계 수
		return this.client.follow.count({
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
		return this.client.follow.count({
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
		return this.client.follow.count({
			where: {
				followerId: userId,
				status: "PENDING",
			},
		});
	}

	/**
	 * 사용자 존재 확인
	 */
	async userExists(userId: string): Promise<boolean> {
		const user = await this.client.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		return user !== null;
	}

	/**
	 * 사용자 표시 이름 조회 (알림용)
	 * profile.name 우선, 없으면 userTag 폴백
	 */
	async getUserDisplayName(userId: string): Promise<string> {
		const user = await this.client.user.findUnique({
			where: { id: userId },
			select: {
				userTag: true,
				profile: {
					select: { name: true },
				},
			},
		});
		return user?.profile?.name ?? user?.userTag ?? userId;
	}

	/**
	 * userTag로 사용자 조회
	 */
	async findUserByTag(userTag: string): Promise<{ id: string } | null> {
		return this.client.user.findUnique({
			where: { userTag },
			select: { id: true },
		});
	}

	/**
	 * 맞팔 친구 ID 목록 조회 (알림 발송용)
	 *
	 * Raw SQL JOIN으로 최적화 (3단계 중첩 쿼리 대신)
	 */
	async getMutualFriendIds(userId: string): Promise<string[]> {
		const result = await this.client.$queryRaw<{ followingId: string }[]>`
			SELECT DISTINCT f1."followingId"
			FROM "Follow" f1
			INNER JOIN "Follow" f2
				ON f1."followingId" = f2."followerId"
				AND f2."followingId" = f1."followerId"
			WHERE f1."followerId" = ${userId}
				AND f1."status" = 'ACCEPTED'
				AND f2."status" = 'ACCEPTED'
		`;

		return result.map((r) => r.followingId);
	}
}

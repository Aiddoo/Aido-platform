import { ErrorCode } from "@aido/errors";
import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import { type Follow as FollowRow, Prisma } from "@/generated/prisma/client";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { USER_BRIEF_SELECT } from "@/shared/infrastructure/database/selects";

import type {
	CreateFollowInput,
	FindFollowsParams,
	FollowRepositoryPort,
	FollowWithUser,
	SearchUsersParams,
	UpdateFollowInput,
	UserSearchResult,
} from "../../application/ports/follow.repository.port";
import { Friendship } from "../../domain/entities/friendship.aggregate";

/** USER_BRIEF_SELECT 결과가 포함된 Follow 행 형태 */
type FollowRowWithUser = FollowRow & {
	follower: {
		id: string;
		userTag: string;
		profile: { name: string | null; profileImage: string | null } | null;
	};
	following: {
		id: string;
		userTag: string;
		profile: { name: string | null; profileImage: string | null } | null;
	};
};

const WITH_USER_INCLUDE = {
	follower: { select: USER_BRIEF_SELECT },
	following: { select: USER_BRIEF_SELECT },
} as const;

/** searchUsers 원시 쿼리 행 형태 (관계 flag는 COALESCE로 boolean 보장) */
interface UserSearchRow {
	id: string;
	userTag: string;
	name: string | null;
	profileImage: string | null;
	isFollowing: boolean;
	isFollower: boolean;
	isFriend: boolean;
	requestPending: boolean;
	rank: number;
}

/**
 * FollowRepositoryPort의 Prisma 어댑터.
 *
 * Prisma Follow 행을 애플리케이션 타입(FollowRecord/FollowWithUser)으로 매핑한다.
 * 트랜잭션은 CLS로 전파되며(TransactionHost.tx), 유니크 제약 위반(P2002)은
 * FOLLOW_0901(followRequestAlreadySent)로 번역한다.
 */
@Injectable()
export class PrismaFollowRepository implements FollowRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	private static toFriendship(row: FollowRow): Friendship {
		return Friendship.reconstitute({
			id: row.id,
			followerId: row.followerId,
			followingId: row.followingId,
			status: row.status,
			sortOrder: row.sortOrder,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	private static toWithUser(row: FollowRowWithUser): FollowWithUser {
		return {
			id: row.id,
			followerId: row.followerId,
			followingId: row.followingId,
			status: row.status,
			sortOrder: row.sortOrder,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			follower: {
				id: row.follower.id,
				userTag: row.follower.userTag,
				profile: row.follower.profile,
			},
			following: {
				id: row.following.id,
				userTag: row.following.userTag,
				profile: row.following.profile,
			},
		};
	}

	async create(input: CreateFollowInput): Promise<Friendship> {
		try {
			const row = await this.client.follow.create({
				data: {
					follower: { connect: { id: input.followerId } },
					following: { connect: { id: input.followingId } },
					status: input.status,
					...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
				},
			});
			return PrismaFollowRepository.toFriendship(row);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ApplicationException(ErrorCode.FOLLOW_0901, {
					targetUserId: input.followingId,
				});
			}
			throw error;
		}
	}

	async findByFollowerAndFollowing(
		followerId: string,
		followingId: string,
	): Promise<Friendship | null> {
		const row = await this.client.follow.findUnique({
			where: { followerId_followingId: { followerId, followingId } },
		});
		return row ? PrismaFollowRepository.toFriendship(row) : null;
	}

	async findByIdWithUser(id: string): Promise<FollowWithUser | null> {
		const row = await this.client.follow.findUnique({
			where: { id },
			include: WITH_USER_INCLUDE,
		});
		return row ? PrismaFollowRepository.toWithUser(row) : null;
	}

	async update(id: string, input: UpdateFollowInput): Promise<Friendship> {
		const row = await this.client.follow.update({
			where: { id },
			data: {
				...(input.status !== undefined && { status: input.status }),
				...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
			},
		});
		return PrismaFollowRepository.toFriendship(row);
	}

	async updateByFollowerAndFollowing(
		followerId: string,
		followingId: string,
		input: UpdateFollowInput,
	): Promise<Friendship> {
		const row = await this.client.follow.update({
			where: { followerId_followingId: { followerId, followingId } },
			data: {
				...(input.status !== undefined && { status: input.status }),
				...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
			},
		});
		return PrismaFollowRepository.toFriendship(row);
	}

	async delete(id: string): Promise<void> {
		await this.client.follow.delete({ where: { id } });
	}

	async findMutualFriends(
		params: FindFollowsParams,
	): Promise<FollowWithUser[]> {
		const { userId, cursor, size, search } = params;
		const searchCondition = search
			? { userTag: { contains: search, mode: "insensitive" as const } }
			: {};

		const rows = await this.client.follow.findMany({
			where: {
				followerId: userId,
				status: "ACCEPTED",
				following: {
					...searchCondition,
					following: {
						some: {
							followerId: { not: userId },
							followingId: userId,
							status: "ACCEPTED",
						},
					},
				},
			},
			include: WITH_USER_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
		});
		return rows.map((row) => PrismaFollowRepository.toWithUser(row));
	}

	async findReceivedRequests(
		params: FindFollowsParams,
	): Promise<FollowWithUser[]> {
		const { userId, cursor, size } = params;
		const rows = await this.client.follow.findMany({
			where: { followingId: userId, status: "PENDING" },
			include: WITH_USER_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaFollowRepository.toWithUser(row));
	}

	async findSentRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
		const { userId, cursor, size } = params;
		const rows = await this.client.follow.findMany({
			where: { followerId: userId, status: "PENDING" },
			include: WITH_USER_INCLUDE,
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaFollowRepository.toWithUser(row));
	}

	async findAcceptedByIdAndFollowerId(
		id: string,
		followerId: string,
	): Promise<Friendship | null> {
		const row = await this.client.follow.findFirst({
			where: { id, followerId, status: "ACCEPTED" },
		});
		return row ? PrismaFollowRepository.toFriendship(row) : null;
	}

	async getMaxSortOrderForFriends(followerId: string): Promise<number> {
		const result = await this.client.follow.aggregate({
			where: { followerId, status: "ACCEPTED" },
			_max: { sortOrder: true },
		});
		return result._max.sortOrder ?? -1;
	}

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

	async updateFollowSortOrder(
		id: string,
		sortOrder: number,
	): Promise<FollowWithUser> {
		const row = await this.client.follow.update({
			where: { id },
			data: { sortOrder },
			include: WITH_USER_INCLUDE,
		});
		return PrismaFollowRepository.toWithUser(row);
	}

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

	async countMutualFriends(userId: string): Promise<number> {
		return this.client.follow.count({
			where: {
				followerId: userId,
				status: "ACCEPTED",
				following: {
					following: {
						some: { followingId: userId, status: "ACCEPTED" },
					},
				},
			},
		});
	}

	async countReceivedRequests(userId: string): Promise<number> {
		return this.client.follow.count({
			where: { followingId: userId, status: "PENDING" },
		});
	}

	async countSentRequests(userId: string): Promise<number> {
		return this.client.follow.count({
			where: { followerId: userId, status: "PENDING" },
		});
	}

	async userExists(userId: string): Promise<boolean> {
		const user = await this.client.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		return user !== null;
	}

	async getUserDisplayName(userId: string): Promise<string> {
		const user = await this.client.user.findUnique({
			where: { id: userId },
			select: {
				userTag: true,
				profile: { select: { name: true } },
			},
		});
		return user?.profile?.name ?? user?.userTag ?? userId;
	}

	async findUserByTag(userTag: string): Promise<{ id: string } | null> {
		return this.client.user.findUnique({
			where: { userTag },
			select: { id: true },
		});
	}

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

	async searchUsers(params: SearchUsersParams): Promise<UserSearchResult[]> {
		const { viewerId, nfcQuery, upperTag, cursor, size } = params;

		// 관련도 랭킹(rank)은 계산값이라 (rank, id) keyset으로 안정 페이지네이션한다.
		// 서브쿼리 밖에서만 rank 별칭을 참조할 수 있어 바깥 WHERE에서 keyset을 적용한다.
		const keyset =
			cursor != null
				? Prisma.sql`AND (s.rank > ${cursor.rank} OR (s.rank = ${cursor.rank} AND s.id > ${cursor.id}))`
				: Prisma.empty;

		const rows = await this.client.$queryRaw<UserSearchRow[]>`
			SELECT s.id, s."userTag", s.name, s."profileImage",
				s."isFollowing", s."isFollower", s."isFriend", s."requestPending", s.rank
			FROM (
				SELECT u.id, u."userTag", p.name, p."profileImage",
					COALESCE(fout.status = 'ACCEPTED', false) AS "isFollowing",
					COALESCE(fin.status = 'ACCEPTED', false) AS "isFollower",
					COALESCE(fout.status = 'ACCEPTED' AND fin.status = 'ACCEPTED', false) AS "isFriend",
					COALESCE(fout.status = 'PENDING', false) AS "requestPending",
					-- 관련도 랭킹(작을수록 상위). 정확 일치 > 접두어 일치 > 부분 일치 순.
					-- 0: 태그 완전 일치, 1: 태그 접두어 일치, 2: 이름 접두어 일치, 3: 그 외 부분 일치.
					-- 동일 rank 내에서는 id ASC로 안정 정렬(keyset 페이지네이션 tie-breaker).
					CASE
						WHEN u."userTag" = ${upperTag} THEN 0
						WHEN u."userTag" ILIKE ${upperTag} || '%' THEN 1
						WHEN p.name ILIKE ${nfcQuery} || '%' THEN 2
						ELSE 3
					END AS rank
				FROM "User" u
				LEFT JOIN "UserProfile" p ON p."userId" = u.id
				LEFT JOIN "Follow" fout
					ON fout."followerId" = ${viewerId} AND fout."followingId" = u.id
				LEFT JOIN "Follow" fin
					ON fin."followerId" = u.id AND fin."followingId" = ${viewerId}
				WHERE u.id <> ${viewerId}
					AND u."deletedAt" IS NULL
					AND u.status = 'ACTIVE'
					AND (
						u."userTag" ILIKE '%' || ${upperTag} || '%'
						OR p.name ILIKE '%' || ${nfcQuery} || '%'
					)
			) s
			WHERE TRUE ${keyset}
			ORDER BY s.rank ASC, s.id ASC
			LIMIT ${size + 1}
		`;

		return rows.map((r) => ({
			id: r.id,
			userTag: r.userTag,
			profile: { name: r.name, profileImage: r.profileImage },
			isFollowing: r.isFollowing,
			isFollower: r.isFollower,
			isFriend: r.isFriend,
			requestPending: r.requestPending,
			rank: Number(r.rank),
		}));
	}

	async countSearchUsers(
		params: Omit<SearchUsersParams, "cursor" | "size">,
	): Promise<number> {
		const { viewerId, nfcQuery, upperTag } = params;
		const result = await this.client.$queryRaw<{ count: bigint }[]>`
			SELECT COUNT(*) AS count
			FROM "User" u
			LEFT JOIN "UserProfile" p ON p."userId" = u.id
			WHERE u.id <> ${viewerId}
				AND u."deletedAt" IS NULL
				AND u.status = 'ACTIVE'
				AND (
					u."userTag" ILIKE '%' || ${upperTag} || '%'
					OR p.name ILIKE '%' || ${nfcQuery} || '%'
				)
		`;
		return Number(result[0]?.count ?? 0);
	}
}

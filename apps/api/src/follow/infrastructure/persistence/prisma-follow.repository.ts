import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";
import sql, { empty } from "sql-template-tag";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import {
  decodeSqlRows,
  sqlRowSpec,
  sqlStatement,
} from "#api/shared/infrastructure/database/database-sql";
import { databaseTimestamp, varchar } from "#api/shared/infrastructure/database/database-values";
import { type Follow as FollowRow } from "#api/shared/infrastructure/database/database.types";
import {
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
  CreateFollowInput,
  FindFollowsParams,
  FollowRepositoryPort,
  FollowWithUser,
  SearchUsersParams,
  UpdateFollowInput,
  UserSearchResult,
} from "../../application/ports/follow.repository.port.js";
import { Friendship } from "../../domain/entities/friendship.aggregate.js";

/** USER_BRIEF_SELECT 결과가 포함된 Follow 행 형태 */
type FollowRowWithUser = FollowRow & {
  follower: {
    id: string;
    userTag: string;
    profile: { name: string | null; profileImage: string | null } | null;
  } | null;
  following: {
    id: string;
    userTag: string;
    profile: { name: string | null; profileImage: string | null } | null;
  } | null;
};

/**
 * FollowRepositoryPort의 Prisma 어댑터.
 *
 * Prisma Follow 행을 애플리케이션 타입(FollowRecord/FollowWithUser)으로 매핑한다.
 * 트랜잭션은 CLS로 전파되며(TransactionHost.tx), 유니크 제약 위반(SQLSTATE 23505)은
 * FOLLOW_0901(followRequestAlreadySent)로 번역한다.
 */
@Injectable()
export class PrismaFollowRepository implements FollowRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private get followsWithUser() {
    return this.client.orm.public.Follow.include("follower", (user) =>
      user
        .select("id", "userTag")
        .include("profile", (profile) => profile.select("name", "profileImage")),
    ).include("following", (user) =>
      user
        .select("id", "userTag")
        .include("profile", (profile) => profile.select("name", "profileImage")),
    );
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
        id: requireRecord(row.follower).id,
        userTag: requireRecord(row.follower).userTag,
        profile: requireRecord(row.follower).profile,
      },
      following: {
        id: requireRecord(row.following).id,
        userTag: requireRecord(row.following).userTag,
        profile: requireRecord(row.following).profile,
      },
    };
  }

  async create(input: CreateFollowInput): Promise<Friendship> {
    try {
      const row = decodeRecord(
        "Follow",
        await this.client.orm.public.Follow.create(
          encodeCreate("Follow", {
            followerId: input.followerId,
            followingId: input.followingId,
            status: input.status,
            ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          }),
        ),
      );
      return PrismaFollowRepository.toFriendship(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
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
    const row = decodeRecord(
      "Follow",
      await this.client.orm.public.Follow.where((row) =>
        and(row.followerId.eq(followerId), row.followingId.eq(followingId)),
      ).first(),
    );
    return row ? PrismaFollowRepository.toFriendship(row) : null;
  }

  async findByIdWithUser(id: string): Promise<FollowWithUser | null> {
    const row = decodeRecord("Follow", await this.followsWithUser.where({ id }).first());
    return row === null ? null : PrismaFollowRepository.toWithUser(row);
  }

  async update(id: string, input: UpdateFollowInput): Promise<Friendship> {
    const row = decodeRecord(
      "Follow",
      requireRecord(
        await this.client.orm.public.Follow.where((row) => row.id.eq(id)).update(
          encodePatch("Follow", {
            ...(input.status !== undefined && { status: input.status }),
            ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          }),
        ),
      ),
    );
    return PrismaFollowRepository.toFriendship(row);
  }

  async updateByFollowerAndFollowing(
    followerId: string,
    followingId: string,
    input: UpdateFollowInput,
  ): Promise<Friendship> {
    const row = decodeRecord(
      "Follow",
      requireRecord(
        await this.client.orm.public.Follow.where((row) =>
          and(row.followerId.eq(followerId), row.followingId.eq(followingId)),
        ).update(
          encodePatch("Follow", {
            ...(input.status !== undefined && { status: input.status }),
            ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          }),
        ),
      ),
    );
    return PrismaFollowRepository.toFriendship(row);
  }

  async delete(id: string): Promise<void> {
    decodeRecord(
      "Follow",
      requireRecord(await this.client.orm.public.Follow.where((row) => row.id.eq(id)).delete()),
    );
  }

  async findMutualFriends(params: FindFollowsParams): Promise<FollowWithUser[]> {
    const { userId, cursor, size, search } = params;
    const pattern =
      search === undefined
        ? undefined
        : `%${search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    let follows = this.followsWithUser
      .where((row) =>
        and(
          row.followerId.eq(userId),
          row.status.eq("ACCEPTED"),
          row.following.some((user) =>
            and(
              pattern !== undefined
                ? this.client.raw.sql`${user.userTag} ILIKE ${pattern}`
                    .returns("pg/bool@1")
                    .buildAst()
                : all(),
              user.following.some((back) =>
                and(
                  back.followerId.neq(userId),
                  back.followingId.eq(userId),
                  back.status.eq("ACCEPTED"),
                ),
              ),
            ),
          ),
        ),
      )
      .orderBy((row) => row.sortOrder.asc())
      .orderBy((row) => row.id.asc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Follow.where({ id: cursor })
        .select("id", "sortOrder")
        .first();
      if (anchor === null) return [];
      follows = follows.cursor(anchor);
    }
    const rows = decodeRecord("Follow", await follows.all());
    return rows.map((row) => PrismaFollowRepository.toWithUser(row));
  }

  async findReceivedRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
    const { userId, cursor, size } = params;
    let follows = this.followsWithUser
      .where({ followingId: userId, status: "PENDING" })
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Follow.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      follows = follows.cursor(anchor);
    }
    const rows = decodeRecord("Follow", await follows.all());
    return rows.map((row) => PrismaFollowRepository.toWithUser(row));
  }

  async findSentRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
    const { userId, cursor, size } = params;
    let follows = this.followsWithUser
      .where({ followerId: userId, status: "PENDING" })
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Follow.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      follows = follows.cursor(anchor);
    }
    const rows = decodeRecord("Follow", await follows.all());
    return rows.map((row) => PrismaFollowRepository.toWithUser(row));
  }

  async findAcceptedByIdAndFollowerId(id: string, followerId: string): Promise<Friendship | null> {
    const row = decodeRecord(
      "Follow",
      await this.client.orm.public.Follow.where((row) =>
        and(row.id.eq(id), row.followerId.eq(followerId), row.status.eq("ACCEPTED")),
      ).first(),
    );
    return row ? PrismaFollowRepository.toFriendship(row) : null;
  }

  async getMaxSortOrderForFriends(followerId: string): Promise<number> {
    const result = await this.client.orm.public.Follow.where((row) =>
      and(row.followerId.eq(followerId), row.status.eq("ACCEPTED")),
    )
      .aggregate((aggregate) => ({ max_sortOrder: aggregate.max("sortOrder") }))
      .then((row) => ({ ...decodeRecord("Follow", row), _max: { sortOrder: row.max_sortOrder } }));
    return result._max.sortOrder ?? -1;
  }

  async shiftFriendSortOrders(
    followerId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    let mutation = this.client.sql.public.Follow.update((fields) => ({
      sortOrder: this.client.raw.sql`${fields.sortOrder} + ${delta}`.returns("pg/int4@1"),
      updatedAt: this.client.raw.sql`${databaseTimestamp(new Date())}`.returns(
        "pg/timestamp-string@1",
      ),
    })).where((fields, functions) =>
      functions.and(
        functions.eq(fields.followerId, followerId),
        functions.eq(fields.status, "ACCEPTED"),
        functions.gte(fields.sortOrder, fromSortOrder),
      ),
    );
    if (toSortOrder !== null)
      mutation = mutation.where((fields, functions) =>
        functions.lte(fields.sortOrder, toSortOrder),
      );
    const result = await this.client.execute(mutation.build());
    return result.affectedRows;
  }

  async updateFollowSortOrder(id: string, sortOrder: number): Promise<FollowWithUser> {
    const row = decodeRecord(
      "Follow",
      requireRecord(await this.followsWithUser.where({ id }).update({ sortOrder })),
    );
    return PrismaFollowRepository.toWithUser(row);
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const [myFollow, theirFollow] = await Promise.all([
      this.client.orm.public.Follow.where((row) =>
        and(row.followerId.eq(userId), row.followingId.eq(targetUserId), row.status.eq("ACCEPTED")),
      )
        .first()
        .then((row) => decodeRecord("Follow", row)),
      this.client.orm.public.Follow.where((row) =>
        and(row.followerId.eq(targetUserId), row.followingId.eq(userId), row.status.eq("ACCEPTED")),
      )
        .first()
        .then((row) => decodeRecord("Follow", row)),
    ]);
    return myFollow !== null && theirFollow !== null;
  }

  async countMutualFriends(userId: string): Promise<number> {
    return this.client.orm.public.Follow.where((row) =>
      and(
        row.followerId.eq(userId),
        row.status.eq("ACCEPTED"),
        requireRecord(row.following).some((related) =>
          related.following.some((related) =>
            and(related.followingId.eq(userId), related.status.eq("ACCEPTED")),
          ),
        ),
      ),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countReceivedRequests(userId: string): Promise<number> {
    return this.client.orm.public.Follow.where((row) =>
      and(row.followingId.eq(userId), row.status.eq("PENDING")),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countSentRequests(userId: string): Promise<number> {
    return this.client.orm.public.Follow.where((row) =>
      and(row.followerId.eq(userId), row.status.eq("PENDING")),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async userExists(userId: string): Promise<boolean> {
    const user = decodeRecord(
      "User",
      await this.client.orm.public.User.where((row) =>
        and(row.id.eq(userId), row.status.eq("ACTIVE"), row.deletedAt.isNull()),
      )
        .select("id")
        .first(),
    );
    return user !== null;
  }

  async getUserDisplayName(userId: string): Promise<string> {
    const user = decodeRecord(
      "User",
      await this.client.orm.public.User.where((row) => row.id.eq(userId))
        .select("userTag")
        .include("profile", (related) => related.select("name"))
        .first(),
    );
    return user?.profile?.name ?? user?.userTag ?? userId;
  }

  async findUserByTag(userTag: string): Promise<{ id: string } | null> {
    return this.client.orm.public.User.where((row) =>
      and(row.userTag.eq(varchar(userTag, 8)), row.status.eq("ACTIVE"), row.deletedAt.isNull()),
    )
      .select("id")
      .first()
      .then((row) => decodeRecord("User", row));
  }

  async getMutualFriendIds(userId: string): Promise<string[]> {
    const rows = decodeRecord(
      "Follow",
      await this.client.orm.public.Follow.where((row) =>
        and(
          row.followerId.eq(userId),
          row.status.eq("ACCEPTED"),
          requireRecord(row.following).some((related) =>
            related.following.some((related) =>
              and(related.followingId.eq(userId), related.status.eq("ACCEPTED")),
            ),
          ),
        ),
      )
        .select("followingId")
        .all(),
    );
    return rows.map((row) => row.followingId);
  }

  async searchUsers(params: SearchUsersParams): Promise<UserSearchResult[]> {
    const sqlRows1 = sqlRowSpec({
      id: "pg/text@1",
      userTag: "pg/text@1",
      name: { codecId: "pg/text@1", nullable: true },
      profileImage: { codecId: "pg/text@1", nullable: true },
      isFollowing: "pg/bool@1",
      isFollower: "pg/bool@1",
      isFriend: "pg/bool@1",
      requestPending: "pg/bool@1",
      rank: "pg/int4@1",
    });

    const { viewerId, nfcQuery, upperTag, cursor, size } = params;

    // 관련도 랭킹(rank)은 계산값이라 (rank, id) keyset으로 안정 페이지네이션한다.
    // 서브쿼리 밖에서만 rank 별칭을 참조할 수 있어 바깥 WHERE에서 keyset을 적용한다.
    const keyset =
      cursor != null
        ? sql`AND (s.rank > ${cursor.rank} OR (s.rank = ${cursor.rank} AND s.id > ${cursor.id}))`
        : empty;

    const rows = decodeSqlRows(
      sqlRows1,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
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
		`,
        )
          .returnsRow(sqlRows1)
          .build(),
      ),
    );

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

  async countSearchUsers(params: Omit<SearchUsersParams, "cursor" | "size">): Promise<number> {
    const sqlRows2 = sqlRowSpec({ count: "pg/int8@1" });

    const { viewerId, nfcQuery, upperTag } = params;
    const result = decodeSqlRows(
      sqlRows2,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
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
		`,
        )
          .returnsRow(sqlRows2)
          .build(),
      ),
    );
    return Number(result[0]?.count ?? 0);
  }
}

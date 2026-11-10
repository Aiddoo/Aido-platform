import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  isNull,
  lte,
  max,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { follow, user, userProfile } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/application/application.exception";

import type {
  CreateFollowInput,
  FindFollowsParams,
  FollowRepositoryPort,
  FollowWithUser,
  SearchUsersParams,
  UpdateFollowInput,
  UserSearchResult,
} from "../../../application/ports/friends/follow.repository.port.js";
import { Friendship } from "../../../domain/aggregates/friends/friendship.aggregate.js";
import { hasNoBlockWith } from "../blocks/drizzle-user-block.filter.js";
import { USER_BRIEF_RELATION, type UserBriefRow } from "../drizzle-user-brief.relation.js";

type FollowRow = typeof follow.$inferSelect;
type FollowRowWithUser = FollowRow & {
  follower: UserBriefRow;
  following: UserBriefRow;
};

const FOLLOW_USER_RELATIONS = {
  follower: USER_BRIEF_RELATION,
  following: USER_BRIEF_RELATION,
} as const;

@Injectable()
export class DrizzleFollowRepository implements FollowRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
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
      const [row] = await this.db
        .insert(follow)
        .values({
          followerId: input.followerId,
          followingId: input.followingId,
          status: input.status,
          ...(input.sortOrder != null && { sortOrder: input.sortOrder }),
        })
        .returning();
      return DrizzleFollowRepository.toFriendship(requireRecord(row));
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
    const row = await this.db.query.follow.findFirst({ where: { followerId, followingId } });
    return row == null ? null : DrizzleFollowRepository.toFriendship(row);
  }

  async findByIdWithUser(id: string): Promise<FollowWithUser | null> {
    const row = await this.db.query.follow.findFirst({
      where: { id },
      with: FOLLOW_USER_RELATIONS,
    });
    return row == null ? null : DrizzleFollowRepository.toWithUser(row);
  }

  async update(id: string, input: UpdateFollowInput): Promise<Friendship> {
    const [row] = await this.db.update(follow).set(input).where(eq(follow.id, id)).returning();
    return DrizzleFollowRepository.toFriendship(requireRecord(row));
  }

  async updateByFollowerAndFollowing(
    followerId: string,
    followingId: string,
    input: UpdateFollowInput,
  ): Promise<Friendship> {
    const [row] = await this.db
      .update(follow)
      .set(input)
      .where(and(eq(follow.followerId, followerId), eq(follow.followingId, followingId)))
      .returning();
    return DrizzleFollowRepository.toFriendship(requireRecord(row));
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.db
      .delete(follow)
      .where(eq(follow.id, id))
      .returning({ id: follow.id });
    requireRecord(row);
  }

  async findMutualFriends(params: FindFollowsParams): Promise<FollowWithUser[]> {
    const { userId, cursor, size, search } = params;
    const pattern =
      search == null
        ? undefined
        : `%${search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const anchor =
      cursor == null
        ? undefined
        : await this.db.query.follow.findFirst({
            columns: { id: true, sortOrder: true },
            where: { id: cursor },
          });
    if (cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.db.query.follow.findMany({
      where: {
        followerId: userId,
        status: "ACCEPTED",
        following: {
          ...(pattern != null && { userTag: { ilike: pattern } }),
          following: { followerId: { ne: userId }, followingId: userId, status: "ACCEPTED" },
        },
        ...(anchor != null && {
          RAW: (table) =>
            sql`(${table.sortOrder}, ${table.id}) > (${anchor.sortOrder}, ${anchor.id})`,
        }),
      },
      with: FOLLOW_USER_RELATIONS,
      orderBy: { sortOrder: "asc", id: "asc" },
      limit: size + 1,
    });
    return rows.map((row) => DrizzleFollowRepository.toWithUser(row));
  }

  findReceivedRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
    return this.findPendingRequests(params, "followingId");
  }

  findSentRequests(params: FindFollowsParams): Promise<FollowWithUser[]> {
    return this.findPendingRequests(params, "followerId");
  }

  private async findPendingRequests(
    { userId, cursor, size }: FindFollowsParams,
    owner: "followerId" | "followingId",
  ): Promise<FollowWithUser[]> {
    const anchor =
      cursor == null
        ? undefined
        : await this.db.query.follow.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: cursor },
          });
    if (cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.db.query.follow.findMany({
      where: {
        ...(owner === "followingId" ? { followingId: userId } : { followerId: userId }),
        status: "PENDING",
        ...(anchor != null && {
          RAW: (table) =>
            sql`(${table.createdAt}, ${table.id}) < (${sql.param(anchor.createdAt, table.createdAt)}, ${anchor.id})`,
        }),
      },
      with: FOLLOW_USER_RELATIONS,
      orderBy: { createdAt: "desc", id: "desc" },
      limit: size + 1,
    });
    return rows.map((row) => DrizzleFollowRepository.toWithUser(row));
  }

  async findAcceptedByIdAndFollowerId(id: string, followerId: string): Promise<Friendship | null> {
    const row = await this.db.query.follow.findFirst({
      where: { id, followerId, status: "ACCEPTED" },
    });
    return row == null ? null : DrizzleFollowRepository.toFriendship(row);
  }

  async getMaxSortOrderForFriends(followerId: string): Promise<number> {
    const [result] = await this.db
      .select({ maximum: max(follow.sortOrder) })
      .from(follow)
      .where(and(eq(follow.followerId, followerId), eq(follow.status, "ACCEPTED")));
    return result?.maximum ?? -1;
  }

  async shiftFriendSortOrders(
    followerId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    const shifted = await this.db
      .update(follow)
      .set({ sortOrder: sql`${follow.sortOrder} + ${delta}` })
      .where(
        and(
          eq(follow.followerId, followerId),
          eq(follow.status, "ACCEPTED"),
          gte(follow.sortOrder, fromSortOrder),
          toSortOrder == null ? undefined : lte(follow.sortOrder, toSortOrder),
        ),
      )
      .returning({ id: follow.id });
    return shifted.length;
  }

  async updateFollowSortOrder(id: string, sortOrder: number): Promise<FollowWithUser> {
    const [updated] = await this.db
      .update(follow)
      .set({ sortOrder })
      .where(eq(follow.id, id))
      .returning({ id: follow.id });
    const row = await this.db.query.follow.findFirst({
      where: { id: requireRecord(updated).id },
      with: FOLLOW_USER_RELATIONS,
    });
    return DrizzleFollowRepository.toWithUser(requireRecord(row));
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const row = await this.db.query.follow.findFirst({
      columns: { id: true },
      where: {
        followerId: userId,
        followingId: targetUserId,
        status: "ACCEPTED",
        following: { following: { followingId: userId, status: "ACCEPTED" } },
      },
    });
    return row != null;
  }

  private mutualFriendCondition(userId: string): SQL | undefined {
    const reverse = alias(follow, "reverse");
    return and(
      eq(follow.followerId, userId),
      eq(follow.status, "ACCEPTED"),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(reverse)
          .where(
            and(
              eq(reverse.followerId, follow.followingId),
              eq(reverse.followingId, userId),
              eq(reverse.status, "ACCEPTED"),
            ),
          ),
      ),
    );
  }

  countMutualFriends(userId: string): Promise<number> {
    return this.db.$count(follow, this.mutualFriendCondition(userId));
  }

  countReceivedRequests(userId: string): Promise<number> {
    return this.db.$count(
      follow,
      and(eq(follow.followingId, userId), eq(follow.status, "PENDING")),
    );
  }

  countSentRequests(userId: string): Promise<number> {
    return this.db.$count(follow, and(eq(follow.followerId, userId), eq(follow.status, "PENDING")));
  }

  async userExists(userId: string): Promise<boolean> {
    const found = await this.db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async getUserDisplayName(userId: string): Promise<string> {
    const found = await this.db.query.user.findFirst({
      columns: { userTag: true },
      where: { id: userId },
      with: { profile: { columns: { name: true } } },
    });
    return found?.profile?.name ?? found?.userTag ?? userId;
  }

  async findUserByTag(userTag: string): Promise<{ id: string } | null> {
    const found = await this.db.query.user.findFirst({
      columns: { id: true },
      where: { userTag, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found ?? null;
  }

  async getMutualFriendIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ followingId: follow.followingId })
      .from(follow)
      .where(this.mutualFriendCondition(userId));
    return rows.map((row) => row.followingId);
  }

  async searchUsers(params: SearchUsersParams): Promise<UserSearchResult[]> {
    const { viewerId, nfcQuery, upperTag, cursor, size } = params;
    const outgoing = alias(follow, "fout");
    const incoming = alias(follow, "fin");

    const candidates = this.db
      .select({
        id: user.id,
        userTag: user.userTag,
        name: userProfile.name,
        profileImage: userProfile.profileImage,
        isFollowing: sql<boolean>`COALESCE(${outgoing.status} = 'ACCEPTED', false)`.as(
          "isFollowing",
        ),
        isFollower: sql<boolean>`COALESCE(${incoming.status} = 'ACCEPTED', false)`.as("isFollower"),
        isFriend:
          sql<boolean>`COALESCE(${outgoing.status} = 'ACCEPTED' AND ${incoming.status} = 'ACCEPTED', false)`.as(
            "isFriend",
          ),
        requestPending: sql<boolean>`COALESCE(${outgoing.status} = 'PENDING', false)`.as(
          "requestPending",
        ),
        rank: sql<number>`CASE
          WHEN ${user.userTag} = ${upperTag} THEN 0
          WHEN ${user.userTag} ILIKE ${upperTag} || '%' THEN 1
          WHEN ${userProfile.name} ILIKE ${nfcQuery} || '%' THEN 2
          ELSE 3
        END`.as("rank"),
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .leftJoin(outgoing, and(eq(outgoing.followerId, viewerId), eq(outgoing.followingId, user.id)))
      .leftJoin(incoming, and(eq(incoming.followerId, user.id), eq(incoming.followingId, viewerId)))
      .where(
        and(
          ne(user.id, viewerId),
          isNull(user.deletedAt),
          eq(user.status, "ACTIVE"),
          hasNoBlockWith(user.id, viewerId),
          or(ilike(user.userTag, `%${upperTag}%`), ilike(userProfile.name, `%${nfcQuery}%`)),
        ),
      )
      .as("s");

    const rows = await this.db
      .select()
      .from(candidates)
      .where(
        cursor == null
          ? undefined
          : or(
              gt(candidates.rank, cursor.rank),
              and(eq(candidates.rank, cursor.rank), gt(candidates.id, cursor.id)),
            ),
      )
      .orderBy(asc(candidates.rank), asc(candidates.id))
      .limit(size + 1);

    return rows.map((row) => ({
      id: row.id,
      userTag: row.userTag,
      profile: { name: row.name, profileImage: row.profileImage },
      isFollowing: row.isFollowing,
      isFollower: row.isFollower,
      isFriend: row.isFriend,
      requestPending: row.requestPending,
      rank: Number(row.rank),
    }));
  }

  countSearchUsers(params: Omit<SearchUsersParams, "cursor" | "size">): Promise<number> {
    const { viewerId, nfcQuery, upperTag } = params;
    return this.db.$count(
      user,
      and(
        ne(user.id, viewerId),
        isNull(user.deletedAt),
        eq(user.status, "ACTIVE"),
        hasNoBlockWith(user.id, viewerId),
        or(
          ilike(user.userTag, `%${upperTag}%`),
          exists(
            this.db
              .select({ one: sql`1` })
              .from(userProfile)
              .where(
                and(eq(userProfile.userId, user.id), ilike(userProfile.name, `%${nfcQuery}%`)),
              ),
          ),
        ),
      ),
    );
  }
}

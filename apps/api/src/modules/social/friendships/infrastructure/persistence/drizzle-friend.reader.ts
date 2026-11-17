import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, exists, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { keyBy } from "es-toolkit";

import {
  UserBriefReaderPort,
  type UserBriefReadModel,
  userTagContainsCondition,
} from "#api/modules/identity/users/identity-users.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";
import { friendship as friendshipTable } from "#api/platform/database/schema/social.schema";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendReaderPort } from "../../application/ports/friend.reader.port.js";
import type {
  FriendReadModel,
  FriendRelationReadModel,
  FriendRequestReadModel,
  FriendUserReadModel,
} from "../../application/read-models/friend.read-model.js";
import type { FriendshipId } from "../../domain/friendship-id.vo.js";

type FriendshipRow = typeof friendshipTable.$inferSelect;
type FriendshipAnchor = Pick<FriendshipRow, "id" | "createdAt">;

function toFriendUser(brief: UserBriefReadModel): FriendUserReadModel {
  return {
    id: brief.userId.value,
    userTag: brief.userTag,
    name: brief.name,
    profileImage: brief.profileImage,
  };
}

@Injectable()
export class DrizzleFriendReader implements FriendReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    userBriefReader: UserBriefReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#userBriefReader = userBriefReader;
  }

  async listFriends(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly tagSearch: string | null;
    readonly limit: number;
  }): Promise<FriendReadModel[]> {
    const { userId, afterFriendshipId, tagSearch, limit } = params;
    const anchor =
      afterFriendshipId == null
        ? null
        : await this.#db.query.friendship.findFirst({
            columns: { id: true, sortOrder: true },
            where: { id: afterFriendshipId.value },
          });
    if (afterFriendshipId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.friendship.findMany({
      where: {
        followerId: userId.value,
        status: "ACCEPTED",
        AND: [
          { RAW: (table) => this.#isFollowedBack(table, userId) },
          ...(tagSearch == null
            ? []
            : [
                {
                  RAW: (table: typeof friendshipTable) =>
                    userTagContainsCondition(table.followingId, tagSearch),
                },
              ]),
          ...(anchor == null
            ? []
            : [
                {
                  RAW: (table: typeof friendshipTable) =>
                    tupleGreaterThan([table.sortOrder, table.id], [anchor.sortOrder, anchor.id]),
                },
              ]),
        ],
      },
      orderBy: { sortOrder: "asc", id: "asc" },
      limit,
    });
    return this.#toFriends(rows);
  }

  async findFriendById(friendshipId: FriendshipId): Promise<FriendReadModel | null> {
    const row = await this.#db.query.friendship.findFirst({ where: { id: friendshipId.value } });
    if (row == null) {
      return null;
    }
    const [friend] = await this.#toFriends([row]);
    return friend ?? null;
  }

  async listReceivedRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly limit: number;
  }): Promise<FriendRequestReadModel[]> {
    const anchor = await this.#findRequestAnchor(params.afterFriendshipId);
    if (params.afterFriendshipId != null && anchor == null) {
      return [];
    }
    const rows = await this.#db.query.friendship.findMany({
      where: {
        followingId: params.userId.value,
        status: "PENDING",
        ...(anchor != null && { RAW: (table) => this.#isBeforeRequest(table, anchor) }),
      },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: params.limit,
    });
    return this.#toFriendRequests(rows, (row) => row.followerId);
  }

  async listSentRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly limit: number;
  }): Promise<FriendRequestReadModel[]> {
    const anchor = await this.#findRequestAnchor(params.afterFriendshipId);
    if (params.afterFriendshipId != null && anchor == null) {
      return [];
    }
    const rows = await this.#db.query.friendship.findMany({
      where: {
        followerId: params.userId.value,
        status: "PENDING",
        ...(anchor != null && { RAW: (table) => this.#isBeforeRequest(table, anchor) }),
      },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: params.limit,
    });
    return this.#toFriendRequests(rows, (row) => row.followingId);
  }

  countReceivedRequests(userId: UserId): Promise<number> {
    return this.#db.$count(
      friendshipTable,
      and(eq(friendshipTable.followingId, userId.value), eq(friendshipTable.status, "PENDING")),
    );
  }

  countSentRequests(userId: UserId): Promise<number> {
    return this.#db.$count(
      friendshipTable,
      and(eq(friendshipTable.followerId, userId.value), eq(friendshipTable.status, "PENDING")),
    );
  }

  async findRelationsWith(
    viewerId: UserId,
    userIds: readonly UserId[],
  ): Promise<FriendRelationReadModel[]> {
    const counterpartIds = userIds.map((userId) => userId.value);
    if (counterpartIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select({
        followerId: friendshipTable.followerId,
        followingId: friendshipTable.followingId,
        status: friendshipTable.status,
      })
      .from(friendshipTable)
      .where(
        or(
          and(
            eq(friendshipTable.followerId, viewerId.value),
            inArray(friendshipTable.followingId, counterpartIds),
          ),
          and(
            eq(friendshipTable.followingId, viewerId.value),
            inArray(friendshipTable.followerId, counterpartIds),
          ),
        ),
      );
    return counterpartIds.map((counterpartId) => {
      const outgoing = rows.find(
        (row) => row.followerId === viewerId.value && row.followingId === counterpartId,
      );
      const incoming = rows.find(
        (row) => row.followerId === counterpartId && row.followingId === viewerId.value,
      );
      return {
        userId: counterpartId,
        isFollowing: outgoing?.status === "ACCEPTED",
        isFollower: incoming?.status === "ACCEPTED",
        isFriend: outgoing?.status === "ACCEPTED" && incoming?.status === "ACCEPTED",
        isRequestPending: outgoing?.status === "PENDING",
      };
    });
  }

  async #toFriends(rows: readonly FriendshipRow[]): Promise<FriendReadModel[]> {
    const users = await this.#findUsers(rows.map((row) => row.followingId));
    return rows.flatMap((row) => {
      const user = users[row.followingId];
      return user == null
        ? []
        : [{ friendshipId: row.id, user: toFriendUser(user), friendsSince: row.updatedAt }];
    });
  }

  async #toFriendRequests(
    rows: readonly FriendshipRow[],
    counterpartOf: (row: FriendshipRow) => string,
  ): Promise<FriendRequestReadModel[]> {
    const users = await this.#findUsers(rows.map(counterpartOf));
    return rows.flatMap((row) => {
      const user = users[counterpartOf(row)];
      return user == null
        ? []
        : [{ friendshipId: row.id, user: toFriendUser(user), requestedAt: row.createdAt }];
    });
  }

  async #findUsers(userIds: readonly string[]): Promise<Record<string, UserBriefReadModel>> {
    const briefs = await this.#userBriefReader.findByUserIds(
      userIds.map((userId) => UserId.reconstitute(userId)),
    );
    return keyBy(briefs, (brief) => brief.userId.value);
  }

  async #findRequestAnchor(
    afterFriendshipId: FriendshipId | null,
  ): Promise<FriendshipAnchor | null> {
    if (afterFriendshipId == null) {
      return null;
    }
    const anchor = await this.#db.query.friendship.findFirst({
      columns: { id: true, createdAt: true },
      where: { id: afterFriendshipId.value },
    });
    return anchor ?? null;
  }

  #isBeforeRequest(table: typeof friendshipTable, anchor: FriendshipAnchor): SQL {
    return tupleLessThan([table.createdAt, table.id], [anchor.createdAt, anchor.id]);
  }

  // 상대도 나를 수락했을 때만 친구다
  #isFollowedBack(table: { readonly followingId: AnyPgColumn }, userId: UserId): SQL {
    const reverse = alias(friendshipTable, "reverse");
    return exists(
      this.#db
        .select({ one: sql`1` })
        .from(reverse)
        .where(
          and(
            eq(reverse.followerId, table.followingId),
            ne(reverse.followerId, userId.value),
            eq(reverse.followingId, userId.value),
            eq(reverse.status, "ACCEPTED"),
          ),
        ),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

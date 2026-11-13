import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";
import { follow } from "#api/platform/database/schema/social.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipReaderPort } from "../../application/ports/friendship.reader.port.js";
import type {
  FriendReadModel,
  FriendRequestReadModel,
  FriendUserReadModel,
} from "../../application/read-models/friend.read-model.js";
import type { FriendshipId } from "../../domain/friendship-id.vo.js";
import { USER_BRIEF_RELATION, type UserBriefRow } from "./user-brief-relation.constants.js";

type FollowRow = typeof follow.$inferSelect;

function toFriendUser(row: UserBriefRow): FriendUserReadModel {
  return {
    id: row.id,
    userTag: row.userTag,
    name: row.profile?.name ?? null,
    profileImage: row.profile?.profileImage ?? null,
  };
}

function toFriend(row: FollowRow & { following: UserBriefRow }): FriendReadModel {
  return {
    friendshipId: row.id,
    user: toFriendUser(row.following),
    friendsSince: row.updatedAt,
  };
}

function toFriendRequest(row: FollowRow, counterpart: UserBriefRow): FriendRequestReadModel {
  return {
    friendshipId: row.id,
    user: toFriendUser(counterpart),
    requestedAt: row.createdAt,
  };
}

// LIKE 와일드카드를 글자 그대로 찾게 한다
function toContainsPattern(search: string): string {
  return `%${search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

@Injectable()
export class DrizzleFriendshipReader implements FriendshipReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
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
        : await this.#db.query.follow.findFirst({
            columns: { id: true, sortOrder: true },
            where: { id: afterFriendshipId.value },
          });
    if (afterFriendshipId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.follow.findMany({
      where: {
        followerId: userId.value,
        status: "ACCEPTED",
        following: {
          ...(tagSearch != null && { userTag: { ilike: toContainsPattern(tagSearch) } }),
          following: {
            followerId: { ne: userId.value },
            followingId: userId.value,
            status: "ACCEPTED",
          },
        },
        ...(anchor != null && {
          RAW: (table) =>
            tupleGreaterThan([table.sortOrder, table.id], [anchor.sortOrder, anchor.id]),
        }),
      },
      with: { following: USER_BRIEF_RELATION },
      orderBy: { sortOrder: "asc", id: "asc" },
      limit,
    });
    return rows.map(toFriend);
  }

  async findFriendById(friendshipId: FriendshipId): Promise<FriendReadModel | null> {
    const row = await this.#db.query.follow.findFirst({
      where: { id: friendshipId.value },
      with: { following: USER_BRIEF_RELATION },
    });
    return row == null ? null : toFriend(row);
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
    const rows = await this.#db.query.follow.findMany({
      where: {
        followingId: params.userId.value,
        status: "PENDING",
        ...(anchor != null && { RAW: (table) => this.#isBeforeRequest(table, anchor) }),
      },
      with: { follower: USER_BRIEF_RELATION },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: params.limit,
    });
    return rows.map((row) => toFriendRequest(row, row.follower));
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
    const rows = await this.#db.query.follow.findMany({
      where: {
        followerId: params.userId.value,
        status: "PENDING",
        ...(anchor != null && { RAW: (table) => this.#isBeforeRequest(table, anchor) }),
      },
      with: { following: USER_BRIEF_RELATION },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: params.limit,
    });
    return rows.map((row) => toFriendRequest(row, row.following));
  }

  countReceivedRequests(userId: UserId): Promise<number> {
    return this.#db.$count(
      follow,
      and(eq(follow.followingId, userId.value), eq(follow.status, "PENDING")),
    );
  }

  countSentRequests(userId: UserId): Promise<number> {
    return this.#db.$count(
      follow,
      and(eq(follow.followerId, userId.value), eq(follow.status, "PENDING")),
    );
  }

  async #findRequestAnchor(
    afterFriendshipId: FriendshipId | null,
  ): Promise<{ id: string; createdAt: Temporal.Instant } | null> {
    if (afterFriendshipId == null) {
      return null;
    }
    const anchor = await this.#db.query.follow.findFirst({
      columns: { id: true, createdAt: true },
      where: { id: afterFriendshipId.value },
    });
    return anchor ?? null;
  }

  #isBeforeRequest(table: typeof follow, anchor: { id: string; createdAt: Temporal.Instant }) {
    return tupleLessThan([table.createdAt, table.id], [anchor.createdAt, anchor.id]);
  }
}

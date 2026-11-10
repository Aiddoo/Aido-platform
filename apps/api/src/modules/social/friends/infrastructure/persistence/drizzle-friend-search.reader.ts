import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, gt, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userProfile } from "#api/platform/database/schema/identity.schema";
import { follow } from "#api/platform/database/schema/social.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { hasNoBlockWith } from "../../../blocks/infrastructure/persistence/drizzle-user-block.repository.js";
import { FriendSearchReaderPort } from "../../application/ports/friend-search.reader.port.js";
import type { UserSearchResultReadModel } from "../../application/read-models/user-search-result.read-model.js";
import type { UserSearchCursor } from "../../application/user-search-cursor.mapper.js";
import type { UserSearchTerm } from "../../domain/user-search-term.vo.js";

@Injectable()
export class DrizzleFriendSearchReader implements FriendSearchReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async searchUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
    readonly after: UserSearchCursor | null;
    readonly limit: number;
  }): Promise<UserSearchResultReadModel[]> {
    const { viewerId, term, after, limit } = params;
    const outgoing = alias(follow, "fout");
    const incoming = alias(follow, "fin");

    const candidates = this.#db
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
          WHEN ${user.userTag} = ${term.upperTag} THEN 0
          WHEN ${user.userTag} ILIKE ${term.upperTag} || '%' THEN 1
          WHEN ${userProfile.name} ILIKE ${term.value} || '%' THEN 2
          ELSE 3
        END`.as("rank"),
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .leftJoin(
        outgoing,
        and(eq(outgoing.followerId, viewerId.value), eq(outgoing.followingId, user.id)),
      )
      .leftJoin(
        incoming,
        and(eq(incoming.followerId, user.id), eq(incoming.followingId, viewerId.value)),
      )
      .where(
        and(
          this.#isSearchable(viewerId),
          or(ilike(user.userTag, `%${term.upperTag}%`), ilike(userProfile.name, `%${term.value}%`)),
        ),
      )
      .as("s");

    const rows = await this.#db
      .select()
      .from(candidates)
      .where(
        after == null
          ? undefined
          : or(
              gt(candidates.rank, after.rank),
              and(eq(candidates.rank, after.rank), gt(candidates.id, after.id)),
            ),
      )
      .orderBy(asc(candidates.rank), asc(candidates.id))
      .limit(limit);

    return rows.map((row) => ({
      user: {
        id: row.id,
        userTag: row.userTag,
        name: row.name,
        profileImage: row.profileImage,
      },
      isFollowing: row.isFollowing,
      isFollower: row.isFollower,
      isFriend: row.isFriend,
      isRequestPending: row.requestPending,
      rank: Number(row.rank),
    }));
  }

  countUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
  }): Promise<number> {
    const { viewerId, term } = params;
    return this.#db.$count(
      user,
      and(
        this.#isSearchable(viewerId),
        or(
          ilike(user.userTag, `%${term.upperTag}%`),
          exists(
            this.#db
              .select({ one: sql`1` })
              .from(userProfile)
              .where(
                and(eq(userProfile.userId, user.id), ilike(userProfile.name, `%${term.value}%`)),
              ),
          ),
        ),
      ),
    );
  }

  #isSearchable(viewerId: UserId) {
    return and(
      ne(user.id, viewerId.value),
      isNull(user.deletedAt),
      eq(user.status, "ACTIVE"),
      hasNoBlockWith(user.id, viewerId.value),
    );
  }
}

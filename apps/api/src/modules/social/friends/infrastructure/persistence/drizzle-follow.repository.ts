import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, exists, gte, lte, max, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { follow } from "#api/platform/database/schema/social.schema";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";

import { friendRequestAlreadySent } from "../../application/friends.errors.js";
import { FollowRepositoryPort } from "../../application/ports/follow.repository.port.js";
import type { SortOrderShift } from "../../domain/friend-ordering.domain-service.js";
import { FriendshipId } from "../../domain/friendship-id.vo.js";
import type { Friendship } from "../../domain/friendship.aggregate.js";
import { toFriendship, toFriendshipRow } from "./friendship-row.mapper.js";

@Injectable()
export class DrizzleFollowRepository implements FollowRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<FriendshipId> {
    return FriendshipId.reconstitute(createEntityId());
  }

  async findByFollowerAndFollowing(
    followerId: UserId,
    followingId: UserId,
  ): Promise<Friendship | null> {
    const row = await this.#db.query.follow.findFirst({
      where: { followerId: followerId.value, followingId: followingId.value },
    });
    return row == null ? null : toFriendship(row);
  }

  async findAcceptedByIdAndFollowerId(
    friendshipId: FriendshipId,
    followerId: UserId,
  ): Promise<Friendship | null> {
    const row = await this.#db.query.follow.findFirst({
      where: { id: friendshipId.value, followerId: followerId.value, status: "ACCEPTED" },
    });
    return row == null ? null : toFriendship(row);
  }

  async findMaxFriendSortOrder(followerId: UserId): Promise<number | null> {
    const [result] = await this.#db
      .select({ maxSortOrder: max(follow.sortOrder) })
      .from(follow)
      .where(and(eq(follow.followerId, followerId.value), eq(follow.status, "ACCEPTED")));
    return result?.maxSortOrder ?? null;
  }

  countMutualFriends(userId: UserId): Promise<number> {
    return this.#db.$count(follow, this.#mutualFriendCondition(userId));
  }

  async existsMutualFriendship(userId: UserId, targetUserId: UserId): Promise<boolean> {
    const row = await this.#db.query.follow.findFirst({
      columns: { id: true },
      where: {
        followerId: userId.value,
        followingId: targetUserId.value,
        status: "ACCEPTED",
        following: { following: { followingId: userId.value, status: "ACCEPTED" } },
      },
    });
    return row != null;
  }

  async listMutualFriendIds(userId: UserId): Promise<UserId[]> {
    const rows = await this.#db
      .select({ followingId: follow.followingId })
      .from(follow)
      .where(this.#mutualFriendCondition(userId));
    return rows.map((row) => UserId.reconstitute(row.followingId));
  }

  async shiftFriendSortOrders(
    followerId: UserId,
    shift: SortOrderShift,
    now: Temporal.Instant,
  ): Promise<void> {
    await this.#db
      .update(follow)
      .set({ sortOrder: sql`${follow.sortOrder} + ${shift.delta}`, updatedAt: now })
      .where(
        and(
          eq(follow.followerId, followerId.value),
          eq(follow.status, "ACCEPTED"),
          gte(follow.sortOrder, shift.fromSortOrder),
          shift.toSortOrder == null ? undefined : lte(follow.sortOrder, shift.toSortOrder),
        ),
      );
  }

  async save(friendship: Friendship): Promise<void> {
    const row = toFriendshipRow(friendship);
    try {
      await this.#db
        .insert(follow)
        .values(row)
        .onConflictDoUpdate({
          target: follow.id,
          set: { status: row.status, sortOrder: row.sortOrder, updatedAt: row.updatedAt },
        });
    } catch (error) {
      // 같은 두 사람·방향 unique(Follow_followerId_followingId_key)는 이미 보낸 요청이다
      if (isUniqueConstraintViolation(error)) {
        throw friendRequestAlreadySent(friendship.followingId);
      }
      throw error;
    }
  }

  async delete(friendship: Friendship): Promise<void> {
    const [deleted] = await this.#db
      .delete(follow)
      .where(eq(follow.id, friendship.id.value))
      .returning({ id: follow.id });
    requireRecord(deleted);
  }

  #mutualFriendCondition(userId: UserId): SQL | undefined {
    const reverse = alias(follow, "reverse");
    return and(
      eq(follow.followerId, userId.value),
      eq(follow.status, "ACCEPTED"),
      exists(
        this.#db
          .select({ one: sql`1` })
          .from(reverse)
          .where(
            and(
              eq(reverse.followerId, follow.followingId),
              eq(reverse.followingId, userId.value),
              eq(reverse.status, "ACCEPTED"),
            ),
          ),
      ),
    );
  }
}

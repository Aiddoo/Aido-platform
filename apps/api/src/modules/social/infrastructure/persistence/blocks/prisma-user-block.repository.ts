import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, or } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { type UserBlock as UserBlockRow } from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  UserBlockReaderPort,
  UserBlockRelation,
} from "../../../application/ports/blocks/user-block-reader.port.js";
import type {
  BlockedUserRecord,
  FindBlockedUsersParams,
  UserBlockRepositoryPort,
} from "../../../application/ports/blocks/user-block.repository.port.js";
import {
  UserBlock,
  type UserBlockCreationPlan,
} from "../../../domain/aggregates/blocks/user-block.aggregate.js";

@Injectable()
export class PrismaUserBlockRepository implements UserBlockRepositoryPort, UserBlockReaderPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private static toUserBlock(row: UserBlockRow): UserBlock {
    return UserBlock.reconstitute({
      id: row.id,
      blockerId: row.blockerId,
      blockedId: row.blockedId,
      createdAt: row.createdAt,
    });
  }

  async userExists(userId: string): Promise<boolean> {
    const user = await this.client.orm.public.User.where((row) =>
      and(row.id.eq(userId), row.status.eq("ACTIVE"), row.deletedAt.isNull()),
    )
      .select("id")
      .first();
    return user != null;
  }

  async findByPair(blockerId: string, blockedId: string): Promise<UserBlock | null> {
    const row = decodeRecord(
      "UserBlock",
      await this.client.orm.public.UserBlock.where({ blockerId, blockedId }).first(),
    );
    return row == null ? null : PrismaUserBlockRepository.toUserBlock(row);
  }

  async create(plan: UserBlockCreationPlan): Promise<UserBlock> {
    const row = decodeRecord(
      "UserBlock",
      await this.client.orm.public.UserBlock.create(
        encodeCreate("UserBlock", {
          blockerId: plan.blockerId,
          blockedId: plan.blockedId,
          createdAt: plan.createdAt,
        }),
      ),
    );
    return PrismaUserBlockRepository.toUserBlock(row);
  }

  async delete(blockerId: string, blockedId: string): Promise<boolean> {
    const affected = await this.client.orm.public.UserBlock.where({
      blockerId,
      blockedId,
    }).deleteAndCount();
    return affected > 0;
  }

  removeFriendshipsBetween(userId: string, otherUserId: string): Promise<number> {
    return this.client.orm.public.Follow.where((row) =>
      or(
        and(row.followerId.eq(userId), row.followingId.eq(otherUserId)),
        and(row.followerId.eq(otherUserId), row.followingId.eq(userId)),
      ),
    ).deleteAndCount();
  }

  async findBlockedUsers(params: FindBlockedUsersParams): Promise<BlockedUserRecord[]> {
    let blocks = this.client.orm.public.UserBlock.include("blocked", (user) =>
      user
        .select("id", "userTag")
        .include("profile", (profile) => profile.select("name", "profileImage")),
    )
      .where((row) =>
        and(
          row.blockerId.eq(params.blockerId),
          row.blocked.some((user) => user.deletedAt.isNull()),
        ),
      )
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(params.size + 1);
    if (params.cursor != null) {
      const anchor = await this.client.orm.public.UserBlock.where({
        id: params.cursor,
        blockerId: params.blockerId,
      })
        .select("id", "createdAt")
        .first();
      if (anchor == null) return [];
      blocks = blocks.cursor(anchor);
    }
    const rows = decodeRecord("UserBlock", await blocks.all());
    return rows.map((row) => {
      const user = requireRecord(row.blocked);
      return {
        id: row.id,
        blockedAt: row.createdAt,
        user: { id: user.id, userTag: user.userTag, profile: user.profile },
      };
    });
  }

  countBlockedUsers(blockerId: string): Promise<number> {
    return this.client.orm.public.UserBlock.where((row) =>
      and(
        row.blockerId.eq(blockerId),
        row.blocked.some((user) => user.deletedAt.isNull()),
      ),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async findRelation(userId: string, otherUserId: string): Promise<UserBlockRelation> {
    const rows = await this.client.orm.public.UserBlock.where((row) =>
      or(
        and(row.blockerId.eq(userId), row.blockedId.eq(otherUserId)),
        and(row.blockerId.eq(otherUserId), row.blockedId.eq(userId)),
      ),
    )
      .select("blockerId")
      .all();
    return {
      isBlocking: rows.some((row) => row.blockerId === userId),
      isBlockedBy: rows.some((row) => row.blockerId === otherUserId),
    };
  }

  async findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const candidates = candidateUserIds.filter((userId) => userId !== viewerId);
    if (candidates.length === 0) return new Set();
    const rows = await this.client.orm.public.UserBlock.where((row) =>
      or(
        and(row.blockerId.eq(viewerId), row.blockedId.in(candidates)),
        and(row.blockedId.eq(viewerId), row.blockerId.in(candidates)),
      ),
    )
      .select("blockerId", "blockedId")
      .all();
    return new Set(rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)));
  }
}

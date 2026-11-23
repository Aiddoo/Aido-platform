import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBriefReaderPort } from "../../application/ports/user-brief.reader.port.js";
import type {
  UserAccountIdentityReadModel,
  UserBriefReadModel,
} from "../../application/read-models/user-brief.read-model.js";

interface UserBriefRow {
  readonly id: string;
  readonly userTag: string;
  readonly deletedAt: Temporal.Instant | null;
  readonly profile: { readonly name: string | null; readonly profileImage: string | null } | null;
}

function toUserBriefReadModel(row: UserBriefRow): UserBriefReadModel {
  return {
    userId: UserId.reconstitute(row.id),
    userTag: row.userTag,
    name: row.profile?.name ?? null,
    profileImage: row.profile?.profileImage ?? null,
    isDeletionPending: row.deletedAt != null,
  };
}

@Injectable()
export class DrizzleUserBriefReader implements UserBriefReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async listByUserIds(userIds: readonly UserId[]): Promise<UserBriefReadModel[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select({
        id: user.id,
        userTag: user.userTag,
        deletedAt: user.deletedAt,
        name: userProfile.name,
        profileImage: userProfile.profileImage,
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(
        inArray(
          user.id,
          userIds.map((userId) => userId.value),
        ),
      );
    return rows.map((row) => ({
      userId: UserId.reconstitute(row.id),
      userTag: row.userTag,
      name: row.name,
      profileImage: row.profileImage,
      isDeletionPending: row.deletedAt != null,
    }));
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId.value, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async findActiveUserIdByTag(userTag: string): Promise<UserId | null> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { userTag, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found == null ? null : UserId.reconstitute(found.id);
  }

  async findAccountIdentity(userId: UserId): Promise<UserAccountIdentityReadModel | null> {
    const found = await this.#db.query.user.findFirst({
      columns: {
        id: true,
        userTag: true,
        deletedAt: true,
        createdAt: true,
        email: true,
        emailVerifiedAt: true,
      },
      where: { id: userId.value },
      with: {
        profile: { columns: { name: true, profileImage: true } },
        accounts: { columns: { provider: true, providerAccountId: true } },
      },
    });
    if (found == null) {
      return null;
    }
    return {
      user: toUserBriefReadModel(found),
      joinedAt: found.createdAt,
      verifiedEmail: found.emailVerifiedAt == null ? null : found.email,
      providerAccounts: found.accounts.map((account) => ({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
    };
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

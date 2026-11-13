import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteUserReaderPort } from "../../application/ports/invite-user.reader.port.js";
import type { InviteeIdentity } from "../../application/read-models/invitee-identity.read-model.js";

@Injectable()
export class DrizzleInviteUserReader implements InviteUserReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findInviteeIdentity(userId: UserId): Promise<InviteeIdentity | null> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true, userTag: true, createdAt: true, email: true, emailVerifiedAt: true },
      where: { id: userId.value },
      with: {
        profile: { columns: { name: true } },
        accounts: { columns: { provider: true, providerAccountId: true } },
      },
    });
    if (found == null) {
      return null;
    }
    return {
      userId: found.id,
      displayName: found.profile?.name ?? found.userTag,
      joinedAt: found.createdAt,
      verifiedEmail: found.emailVerifiedAt == null ? null : found.email,
      providerAccounts: found.accounts.map((account) => ({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
    };
  }

  async findDisplayName(userId: UserId): Promise<string | null> {
    const found = await this.#db.query.user.findFirst({
      columns: { userTag: true },
      where: { id: userId.value, deletedAt: { isNull: true } },
      with: { profile: { columns: { name: true } } },
    });
    if (found == null) {
      return null;
    }
    return found.profile?.name ?? found.userTag;
  }
}

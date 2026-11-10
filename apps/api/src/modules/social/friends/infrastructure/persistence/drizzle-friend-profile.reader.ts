import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendProfileReaderPort } from "../../application/ports/friend-profile.reader.port.js";
import type { UserTag } from "../../domain/user-tag.vo.js";

@Injectable()
export class DrizzleFriendProfileReader implements FriendProfileReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId.value, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async findActiveUserIdByTag(userTag: UserTag): Promise<UserId | null> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { userTag: userTag.value, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found == null ? null : UserId.reconstitute(found.id);
  }

  async findDisplayName(userId: UserId): Promise<string | null> {
    const found = await this.#db.query.user.findFirst({
      columns: { userTag: true },
      where: { id: userId.value },
      with: { profile: { columns: { name: true } } },
    });
    return found == null ? null : (found.profile?.name ?? found.userTag);
  }
}

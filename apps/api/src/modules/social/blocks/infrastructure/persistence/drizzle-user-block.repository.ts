import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userBlock } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserBlockRepositoryPort } from "../../application/ports/user-block.repository.port.js";
import type { UserBlock } from "../../domain/user-block.aggregate.js";
import { toUserBlock, toUserBlockRow } from "./user-block-row.mapper.js";

@Injectable()
export class DrizzleUserBlockRepository implements UserBlockRepositoryPort {
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

  async findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null> {
    const row = await this.#db.query.userBlock.findFirst({
      where: { blockerId: blockerId.value, blockedId: blockedId.value },
    });
    return row == null ? null : toUserBlock(row);
  }

  async save(block: UserBlock): Promise<void> {
    // 차단은 만든 뒤 바뀌지 않아 같은 id를 다시 저장하면 그대로 둔다
    await this.#db
      .insert(userBlock)
      .values(toUserBlockRow(block))
      .onConflictDoNothing({ target: userBlock.id });
  }

  async delete(block: UserBlock): Promise<void> {
    await this.#db.delete(userBlock).where(eq(userBlock.id, block.id.value));
  }
}

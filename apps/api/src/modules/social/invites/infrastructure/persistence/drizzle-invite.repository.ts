import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { invite as inviteTable } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteRepositoryPort } from "../../application/ports/invite.repository.port.js";
import type { Invite } from "../../domain/invite.aggregate.js";
import { INVITE_COLUMNS, toInvite, toInviteRow } from "./invite-row.mapper.js";

@Injectable()
export class DrizzleInviteRepository implements InviteRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findActiveByInviterId(inviterId: UserId): Promise<Invite | null> {
    const row = await this.#db.query.invite.findFirst({
      columns: INVITE_COLUMNS,
      where: { inviterId: inviterId.value, status: "ACTIVE" },
    });
    return row == null ? null : toInvite(row);
  }

  async saveIfCodeUnused(invite: Invite): Promise<boolean> {
    // 코드 충돌은 SAVEPOINT 없이 건너뛰어 호출자가 새 코드로 다시 시도한다
    const inserted = await this.#db
      .insert(inviteTable)
      .values({ ...toInviteRow(invite), updatedAt: this.#clock.now() })
      .onConflictDoNothing({ target: inviteTable.code })
      .returning({ id: inviteTable.id });
    return inserted.length === 1;
  }

  async save(invite: Invite): Promise<void> {
    const row = toInviteRow(invite);
    await this.#db
      .update(inviteTable)
      .set({ status: row.status, revokedAt: row.revokedAt, updatedAt: this.#clock.now() })
      .where(eq(inviteTable.id, row.id));
  }
}

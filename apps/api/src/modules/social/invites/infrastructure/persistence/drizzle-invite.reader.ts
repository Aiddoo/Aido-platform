import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import type { InviteCode } from "../../../shared/domain/invite-code.vo.js";
import type { InviteReaderPort } from "../../application/ports/invite.reader.port.js";
import type { InviteWithInviterReadModel } from "../../application/read-models/inviter-profile.read-model.js";

@Injectable()
export class DrizzleInviteReader implements InviteReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviterReadModel | null> {
    const row = await this.#db.query.invite.findFirst({
      columns: { id: true, inviterId: true, status: true },
      where: { code: code.value },
      with: {
        inviter: {
          columns: { id: true, userTag: true, deletedAt: true },
          with: { profile: { columns: { name: true, profileImage: true } } },
        },
      },
    });
    // 탈퇴 대기 중인 사람의 초대는 없는 코드와 같게 다뤄 계정 상태를 드러내지 않는다
    if (row == null || row.inviter.deletedAt != null) {
      return null;
    }
    return {
      inviteId: row.id,
      inviterId: row.inviterId,
      isActive: row.status === "ACTIVE",
      inviter: {
        userId: row.inviter.id,
        userTag: row.inviter.userTag,
        name: row.inviter.profile?.name ?? null,
        profileImage: row.inviter.profile?.profileImage ?? null,
      },
    };
  }
}

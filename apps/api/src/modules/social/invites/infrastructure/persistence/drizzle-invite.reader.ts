import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { UserBriefReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteCode } from "../../../shared/domain/invite-code.vo.js";
import type { InviteReaderPort } from "../../application/ports/invite.reader.port.js";
import type { InviteWithInviterReadModel } from "../../application/read-models/inviter-profile.read-model.js";

@Injectable()
export class DrizzleInviteReader implements InviteReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    userBriefReader: UserBriefReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#userBriefReader = userBriefReader;
  }

  async findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviterReadModel | null> {
    const row = await this.#transactionHost.tx.query.invite.findFirst({
      columns: { id: true, inviterId: true, status: true },
      where: { code: code.value },
    });
    if (row == null) {
      return null;
    }
    const [inviter] = await this.#userBriefReader.findByUserIds([
      UserId.reconstitute(row.inviterId),
    ]);
    // 탈퇴 대기 중인 사람의 초대는 없는 코드와 같게 다뤄 계정 상태를 드러내지 않는다
    if (inviter == null || inviter.isDeletionPending) {
      return null;
    }
    return {
      inviteId: row.id,
      inviterId: row.inviterId,
      isActive: row.status === "ACTIVE",
      inviter: {
        userId: inviter.userId.value,
        userTag: inviter.userTag,
        name: inviter.name,
        profileImage: inviter.profileImage,
      },
    };
  }
}

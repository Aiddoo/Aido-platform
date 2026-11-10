import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { invite } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/application/application.exception";

import type {
  InviteRepositoryPort,
  InviteWithInviter,
  IssueInviteInput,
} from "../../application/ports/invite.repository.port.js";
import { InviteCode } from "../../domain/invite-code.vo.js";
import { Invite } from "../../domain/invite.aggregate.js";
import { InviteCodeGenerator } from "../adapters/invite-code-generator.adapter.js";

const INVITE_COLUMNS = {
  id: true,
  inviterId: true,
  code: true,
  status: true,
  createdAt: true,
  revokedAt: true,
} as const;

@Injectable()
export class DrizzleInviteRepository implements InviteRepositoryPort {
  static readonly MAX_CODE_ATTEMPTS = 5;

  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #codeGenerator: InviteCodeGenerator;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    codeGenerator: InviteCodeGenerator,
  ) {
    this.#txHost = txHost;
    this.#codeGenerator = codeGenerator;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findActiveByInviterId(inviterId: string): Promise<Invite | null> {
    const row = await this.#db.query.invite.findFirst({
      columns: INVITE_COLUMNS,
      where: { inviterId, status: "ACTIVE" },
    });
    return row == null ? null : Invite.reconstitute(row);
  }

  async findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviter | null> {
    const row = await this.#db.query.invite.findFirst({
      columns: INVITE_COLUMNS,
      where: { code: code.value },
      with: {
        inviter: {
          columns: { id: true, userTag: true, deletedAt: true },
          with: { profile: { columns: { name: true, profileImage: true } } },
        },
      },
    });
    if (row == null) {
      return null;
    }
    const { inviter } = row;
    // 탈퇴 대기 중인 사람의 초대는 없는 코드와 같게 다뤄 계정 상태를 드러내지 않는다
    if (inviter.deletedAt != null) {
      return null;
    }
    return {
      invite: Invite.reconstitute(row),
      inviter: {
        userId: inviter.id,
        userTag: inviter.userTag,
        name: inviter.profile?.name ?? null,
        profileImage: inviter.profile?.profileImage ?? null,
      },
    };
  }

  async issue(input: IssueInviteInput): Promise<Invite> {
    for (let attempt = 0; attempt < DrizzleInviteRepository.MAX_CODE_ATTEMPTS; attempt++) {
      const plan = Invite.planIssue({
        inviterId: input.inviterId,
        code: InviteCode.of(this.#codeGenerator.generate()),
        issuedAt: input.issuedAt,
      });
      // 코드 충돌은 SAVEPOINT 없이 건너뛰고 새 코드로 다시 시도한다
      const [row] = await this.#db
        .insert(invite)
        .values(plan)
        .onConflictDoNothing({ target: invite.code })
        .returning();
      if (row != null) {
        return Invite.reconstitute(row);
      }
    }
    throw new ApplicationException(ErrorCode.SYS_0001, {
      detail: "Invite code collision retries exhausted",
      attempts: DrizzleInviteRepository.MAX_CODE_ATTEMPTS,
    });
  }

  async saveRevocation(target: Invite): Promise<boolean> {
    const updated = await this.#db
      .update(invite)
      .set({ status: target.status, revokedAt: target.revokedAt })
      .where(and(eq(invite.id, target.id), eq(invite.status, "ACTIVE")))
      .returning({ id: invite.id });
    return updated.length === 1;
  }
}

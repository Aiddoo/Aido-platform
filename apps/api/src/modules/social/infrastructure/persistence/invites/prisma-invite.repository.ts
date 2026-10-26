import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { varchar } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  InviteRepositoryPort,
  InviteWithInviter,
  IssueInviteInput,
} from "../../../application/ports/invites/invite.repository.port.js";
import { Invite } from "../../../domain/aggregates/invites/invite.aggregate.js";
import { InviteCode } from "../../../domain/value-objects/invites/invite-code.vo.js";
import { InviteCodeGenerator } from "./invite-code.generator.js";

const INVITE_COLUMNS = ["id", "inviterId", "code", "status", "createdAt", "revokedAt"] as const;

@Injectable()
export class PrismaInviteRepository implements InviteRepositoryPort {
  static readonly MAX_CODE_ATTEMPTS = 5;

  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    private readonly codeGenerator: InviteCodeGenerator,
  ) {}

  private get client() {
    return this.txHost.tx;
  }

  async findActiveByInviterId(inviterId: string): Promise<Invite | null> {
    const row = decodeRecord(
      "Invite",
      await this.client.orm.public.Invite.where((invite) =>
        and(invite.inviterId.eq(inviterId), invite.status.eq("ACTIVE")),
      )
        .select(...INVITE_COLUMNS)
        .first(),
    );
    return row == null ? null : Invite.reconstitute(row);
  }

  async findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviter | null> {
    const row = decodeRecord(
      "Invite",
      await this.client.orm.public.Invite.where((invite) => invite.code.eq(varchar(code.value, 6)))
        .select(...INVITE_COLUMNS)
        .include("inviter", (user) =>
          user
            .select("id", "userTag", "deletedAt")
            .include("profile", (profile) => profile.select("name", "profileImage")),
        )
        .first(),
    );
    if (row == null) return null;
    const inviter = requireRecord(row.inviter);
    // 탈퇴 대기 중인 사람의 초대는 없는 코드와 같게 다뤄 계정 상태를 드러내지 않는다
    if (inviter.deletedAt != null) return null;
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
    for (let attempt = 0; attempt < PrismaInviteRepository.MAX_CODE_ATTEMPTS; attempt++) {
      const plan = Invite.planIssue({
        inviterId: input.inviterId,
        code: InviteCode.of(this.codeGenerator.generate()),
        issuedAt: input.issuedAt,
      });
      // 코드 충돌은 SAVEPOINT 없이 건너뛰고 새 코드로 다시 시도한다
      const [row] = decodeRecord(
        "Invite",
        await this.client.orm.public.Invite.createAll([encodeCreate("Invite", plan)], {
          onConflict: "skip",
          conflictOn: ["code"],
        }),
      );
      if (row != null) return Invite.reconstitute(row);
    }
    throw new ApplicationException(ErrorCode.SYS_0001, {
      detail: "Invite code collision retries exhausted",
      attempts: PrismaInviteRepository.MAX_CODE_ATTEMPTS,
    });
  }

  async saveRevocation(invite: Invite): Promise<boolean> {
    const updated = await this.client.orm.public.Invite.where((row) =>
      and(row.id.eq(invite.id), row.status.eq("ACTIVE")),
    ).updateAndCount(encodePatch("Invite", { status: invite.status, revokedAt: invite.revokedAt }));
    return updated === 1;
  }
}

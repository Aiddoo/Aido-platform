import type { InviterProgressReaderPort } from "#api/modules/social/invite-redemptions/social-invite-redemption-queries.public";

import type { Invite } from "../../domain/invite.aggregate.js";
import type { MyInvite } from "../read-models/my-invite.read-model.js";

export interface SummarizeMyInviteQuery {
  readonly invite: Invite;
  readonly now: Temporal.Instant;
}

export interface SummarizeMyInviteDependencies {
  readonly inviterProgressReader: Pick<InviterProgressReaderPort, "readProgress">;
}

// 조회와 재발급이 같은 요약을 반환한다. 인원·보상 진행은 수락 slice가 센다
export class SummarizeMyInviteUseCase {
  readonly #dependencies: SummarizeMyInviteDependencies;

  constructor(dependencies: SummarizeMyInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: SummarizeMyInviteQuery): Promise<MyInvite> {
    const { invite, now } = query;
    const progress = await this.#dependencies.inviterProgressReader.readProgress(
      invite.inviterId,
      now,
    );
    return { ...progress, code: invite.code.value, createdAt: invite.createdAt };
  }
}
